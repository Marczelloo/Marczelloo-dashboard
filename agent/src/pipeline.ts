import path from "node:path";
import { buildOverride, composeArgs, loopbackPortOverride, renderOverride, resolveComposeFile, type ComposeConfigJson } from "./compose";
import { gitCheckoutStep, gitSyncSteps, type CommandStep } from "./git";
import { assessContainers, assessProbe, type ContainerSample } from "./health";
import type { JobOutcome } from "./queue";
import type { Job, Release } from "./types";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface GateOptions {
  stableMs: number;
  timeoutMs: number;
  intervalMs: number;
  probeTimeoutMs: number;
}

export interface PipelineDeps {
  run(step: CommandStep): Promise<CommandResult>;
  exists(filePath: string): boolean;
  writeFile(filePath: string, content: string): void;
  sampleContainers(composeProject: string): Promise<ContainerSample[]>;
  probe(url: string): Promise<number | null>;
  sleep(ms: number): Promise<void>;
  log(line: string): void;
  now(): number;
  overrideDir: string;
  gate: GateOptions;
}

class StepError extends Error {}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

function dockerStep(label: string, args: string[], timeoutMs: number, quiet = false): CommandStep {
  return { label, command: "docker", args, timeoutMs, quiet };
}

async function runStep(deps: PipelineDeps, step: CommandStep): Promise<CommandResult> {
  deps.log(`=== ${step.label} ===`);
  const result = await deps.run(step);
  if (result.code !== 0 && !step.allowFailure) {
    const detail = result.stderr.trim().split("\n").slice(-5).join("\n");
    throw new StepError(`${step.label}: kod ${result.code}${detail ? `\n${detail}` : ""}`);
  }
  if (step.failOnOutput && result.stdout.trim()) throw new StepError(step.failOnOutput);
  return result;
}

async function composeConfig(job: Job, composeFile: string, deps: PipelineDeps): Promise<ComposeConfigJson> {
  const result = await runStep(deps, dockerStep("Compose config", [...composeArgs(job.target, [composeFile]), "config", "--format", "json"], 120_000, true));
  try {
    return JSON.parse(result.stdout) as ComposeConfigJson;
  } catch {
    throw new StepError("docker compose config zwrócił niepoprawny JSON.");
  }
}

const overridePath = (job: Job, deps: PipelineDeps) => path.posix.join(deps.overrideDir, `${job.target.composeProject}.yml`);

export async function waitForHealth(job: Job, deps: PipelineDeps): Promise<string | null> {
  deps.log("=== Bramka zdrowia ===");
  const started = deps.now();
  const samples: ContainerSample[][] = [];
  for (;;) {
    samples.push(await deps.sampleContainers(job.target.composeProject));
    const verdict = assessContainers(samples, deps.now() - started, deps.gate);
    if (verdict.state === "pass") break;
    if (verdict.state === "fail") return verdict.reason;
    await deps.sleep(deps.gate.intervalMs);
  }
  deps.log("Kontenery stabilne.");

  if (job.target.tunnel) {
    const url = `https://${job.target.tunnel.hostname}/`;
    const probeStarted = deps.now();
    for (;;) {
      const status = await deps.probe(url);
      deps.log(`Sonda ${url}: ${status ?? "brak odpowiedzi"}`);
      if (assessProbe(status) === "pass") break;
      if (deps.now() - probeStarted >= deps.gate.probeTimeoutMs) {
        return `Domena ${job.target.tunnel.hostname} nie odpowiada poprawnie (ostatni status: ${status ?? "brak"}).`;
      }
      await deps.sleep(deps.gate.intervalMs);
    }
  }
  return null;
}

async function upAndCheck(job: Job, files: string[], deps: PipelineDeps): Promise<string | null> {
  await runStep(deps, dockerStep("Uruchomienie", [...composeArgs(job.target, files), "up", "-d", "--no-build"], 10 * 60_000));
  return waitForHealth(job, deps);
}

async function restoreRelease(job: Job, release: Release, deps: PipelineDeps): Promise<string | null> {
  await runStep(deps, gitCheckoutStep(job.target.repoPath, release.sha));
  const composeFile = resolveComposeFile(job.target, deps.exists);
  const config = await composeConfig(job, composeFile, deps);
  const port = job.target.tunnel ? loopbackPortOverride(config, job.target.tunnel.localPort) : null;
  const file = overridePath(job, deps);
  deps.writeFile(file, renderOverride(release.images, port));
  return upAndCheck(job, [composeFile, file], deps);
}

function failed(error: string): JobOutcome {
  return { status: "failed", error, rolledBackTo: null, release: null, orphanImages: [] };
}

async function rollbackAfterFailure(job: Job, previous: Release | null, reason: string, builtImages: Record<string, string>, deps: PipelineDeps): Promise<JobOutcome> {
  if (!previous || previous.sha === job.sha) return failed(`${reason} Brak wcześniejszej wersji do przywrócenia.`);
  const short = previous.sha.slice(0, 7);
  deps.log(`=== Rollback do ${short} ===`);
  try {
    const restoreFailure = await restoreRelease(job, previous, deps);
    if (restoreFailure) return failed(`${reason} Rollback do ${short} nie przeszedł bramki: ${restoreFailure}`);
    const kept = new Set(Object.values(previous.images));
    return { status: "rolled_back", error: reason, rolledBackTo: previous.sha, release: null, orphanImages: Object.values(builtImages).filter((image) => !kept.has(image)) };
  } catch (error) {
    return failed(`${reason} Rollback do ${short} nie powiódł się: ${describeError(error)}`);
  }
}

export async function runDeploy(job: Job, token: string | null, previous: Release | null, deps: PipelineDeps): Promise<JobOutcome> {
  const { target } = job;
  let containersTouched = false;
  let images: Record<string, string> = {};
  try {
    const repoExists = deps.exists(`${target.repoPath}/.git`);
    if (!repoExists && deps.exists(target.repoPath)) {
      throw new StepError(`Katalog ${target.repoPath} istnieje, ale nie jest repozytorium Git.`);
    }
    for (const step of gitSyncSteps({ repoPath: target.repoPath, githubUrl: target.githubUrl, sha: job.sha, token, repoExists })) {
      await runStep(deps, step);
    }

    const composeFile = resolveComposeFile(target, deps.exists);
    const config = await composeConfig(job, composeFile, deps);
    const override = buildOverride(config, { project: target.composeProject, sha: job.sha, tunnelPort: target.tunnel?.localPort ?? null });
    images = override.images;
    const file = overridePath(job, deps);
    deps.writeFile(file, override.yaml);
    const files = [composeFile, file];

    await runStep(deps, dockerStep("Walidacja Compose", [...composeArgs(target, files), "config", "-q"], 120_000));
    await runStep(deps, dockerStep("Build", [...composeArgs(target, files), "build"], 45 * 60_000));

    containersTouched = true;
    const failure = await upAndCheck(job, files, deps);
    if (!failure) {
      return { status: "succeeded", error: null, rolledBackTo: null, release: { sha: job.sha, images, deployedAt: new Date(deps.now()).toISOString() }, orphanImages: [] };
    }
    return rollbackAfterFailure(job, previous, failure, images, deps);
  } catch (error) {
    return containersTouched ? rollbackAfterFailure(job, previous, describeError(error), images, deps) : failed(describeError(error));
  }
}

export async function runRollback(job: Job, release: Release, deps: PipelineDeps): Promise<JobOutcome> {
  try {
    const failure = await restoreRelease(job, release, deps);
    if (failure) return failed(`Przywrócona wersja ${release.sha.slice(0, 7)} nie przeszła bramki: ${failure}`);
    return { status: "succeeded", error: null, rolledBackTo: null, release: { ...release, deployedAt: new Date(deps.now()).toISOString() }, orphanImages: [] };
  } catch (error) {
    return failed(describeError(error));
  }
}
