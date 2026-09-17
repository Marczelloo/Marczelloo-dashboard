import path from "node:path";
import { buildOverride, composeArgs, edgeAttachment, loopbackPortOverride, renderOverride, resolveComposeFile, type ComposeConfigJson } from "./compose";
import { gitAuthEnv, gitCheckoutStep, gitSyncSteps, SHA, type CommandStep } from "./git";
import { assessContainers, assessProbe, type ContainerSample } from "./health";
import type { JobOutcome } from "./queue";
import type { EnvFile, Job, Release } from "./types";

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
  replaceFile(filePath: string, content: string): void;
  removeFile(filePath: string): void;
  sampleContainers(composeProject: string): Promise<ContainerSample[]>;
  /** Compose service → image ID of the running container. */
  serviceImages(composeProject: string): Promise<Record<string, string>>;
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

/** The repository's compose file, or the dashboard-rendered one written next to the override. */
function prepareComposeFile(job: Job, deps: PipelineDeps): string {
  if (!job.target.generatedCompose) return resolveComposeFile(job.target, deps.exists);
  const file = path.posix.join(deps.overrideDir, `${job.target.composeProject}.generated.yml`);
  deps.writeFile(file, job.target.generatedCompose);
  return file;
}

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

  // Only probe the domain when its route already points at this port; otherwise
  // the dashboard switches the route after a successful deploy.
  if (job.target.tunnel?.probe) {
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

/** The edge network is shared by every project, so it is created outside any Compose project. */
async function ensureEdgeNetwork(job: Job, deps: PipelineDeps): Promise<void> {
  const network = job.target.edge?.network;
  if (!network) return;
  const inspected = await deps.run({ ...dockerStep("Sieć edge", ["network", "inspect", "--format", "{{.Name}}", network], 30_000, true), allowFailure: true });
  if (inspected.code === 0) return;
  await runStep(deps, dockerStep(`Tworzenie sieci ${network}`, ["network", "create", network], 30_000));
}

async function upAndCheck(job: Job, files: string[], deps: PipelineDeps): Promise<string | null> {
  // --pull missing: a service with pull_policy "always" must not replace the image just built.
  await runStep(deps, dockerStep("Uruchomienie", [...composeArgs(job.target, files), "up", "-d", "--no-build", "--pull", "missing"], 10 * 60_000));
  return waitForHealth(job, deps);
}

async function restoreRelease(job: Job, release: Release, deps: PipelineDeps): Promise<string | null> {
  await runStep(deps, gitCheckoutStep(job.target.repoPath, release.sha));
  const composeFile = prepareComposeFile(job, deps);
  const config = await composeConfig(job, composeFile, deps);
  const port = job.target.tunnel && !job.target.edge?.dropPorts ? loopbackPortOverride(config, job.target.tunnel.localPort) : null;
  const file = overridePath(job, deps);
  deps.writeFile(file, renderOverride(release.images, port, edgeAttachment(config, job.target.edge, job.target.tunnel?.localPort ?? null, job.target.tunnel?.service ?? null)));
  await ensureEdgeNetwork(job, deps);
  return upAndCheck(job, [composeFile, file], deps);
}

function envFilePath(job: Job, name: string): string {
  const repoPath = path.posix.resolve(job.target.repoPath);
  const filePath = path.posix.resolve(repoPath, name);
  if (!filePath.startsWith(`${repoPath}/`)) throw new StepError("Plik zmiennych musi leżeć w katalogu repozytorium.");
  return filePath;
}

async function readHead(job: Job, deps: PipelineDeps): Promise<string | null> {
  const result = await runStep(deps, {
    label: "Aktualny commit",
    command: "git",
    args: ["-C", job.target.repoPath, "rev-parse", "HEAD"],
    env: gitAuthEnv(null),
    timeoutMs: 30_000,
    quiet: true,
    allowFailure: true,
  });
  const head = result.stdout.trim();
  return result.code === 0 && SHA.test(head) ? head : null;
}

/**
 * Tag the images of the running containers with the commit that is checked out
 * now, so a first agent deploy (or one after a script deploy) can roll back to
 * the version that was actually live.
 */
async function captureBaseline(job: Job, liveSha: string | null, previous: Release | null, builtImages: Record<string, string>, deps: PipelineDeps): Promise<Release | null> {
  if (!liveSha || liveSha === job.sha || previous?.sha === liveSha) return null;
  const running = await deps.serviceImages(job.target.composeProject);
  const images: Record<string, string> = {};
  for (const [service, builtImage] of Object.entries(builtImages)) {
    const imageId = running[service];
    if (!imageId) continue;
    const reference = `${builtImage.slice(0, builtImage.lastIndexOf(":"))}:${liveSha.slice(0, 12)}`;
    await runStep(deps, dockerStep(`Kopia bieżącej wersji ${service}`, ["image", "tag", imageId, reference], 60_000));
    images[service] = reference;
  }
  return Object.keys(images).length ? { sha: liveSha, images, deployedAt: new Date(deps.now()).toISOString() } : null;
}

function failed(error: string, baseline: Release | null = null): JobOutcome {
  return { status: "failed", error, rolledBackTo: null, release: null, baseline, orphanImages: [] };
}

async function rollbackAfterFailure(job: Job, target: Release | null, baseline: Release | null, reason: string, builtImages: Record<string, string>, deps: PipelineDeps): Promise<JobOutcome> {
  if (!target || target.sha === job.sha) return failed(`${reason} Brak wcześniejszej wersji do przywrócenia.`, baseline);
  const short = target.sha.slice(0, 7);
  deps.log(`=== Rollback do ${short} ===`);
  try {
    const restoreFailure = await restoreRelease(job, target, deps);
    if (restoreFailure) return failed(`${reason} Rollback do ${short} nie przeszedł bramki: ${restoreFailure}`, baseline);
    const kept = new Set(Object.values(target.images));
    return {
      status: "rolled_back",
      error: reason,
      rolledBackTo: target.sha,
      release: null,
      baseline,
      orphanImages: Object.values(builtImages).filter((image) => !kept.has(image)),
    };
  } catch (error) {
    return failed(`${reason} Rollback do ${short} nie powiódł się: ${describeError(error)}`, baseline);
  }
}

export async function runDeploy(job: Job, token: string | null, previous: Release | null, deps: PipelineDeps): Promise<JobOutcome> {
  const { target } = job;
  let containersTouched = false;
  let images: Record<string, string> = {};
  let baseline: Release | null = null;
  let rollbackTarget: Release | null = null;
  try {
    const repoExists = deps.exists(`${target.repoPath}/.git`);
    if (!repoExists && deps.exists(target.repoPath)) {
      throw new StepError(`Katalog ${target.repoPath} istnieje, ale nie jest repozytorium Git.`);
    }
    const liveSha = repoExists ? await readHead(job, deps) : null;
    for (const step of gitSyncSteps({ repoPath: target.repoPath, githubUrl: target.githubUrl, sha: job.sha, token, repoExists })) {
      await runStep(deps, step);
    }

    const composeFile = prepareComposeFile(job, deps);
    const config = await composeConfig(job, composeFile, deps);
    const override = buildOverride(config, { project: target.composeProject, sha: job.sha, tunnelPort: target.tunnel?.localPort ?? null, tunnelService: target.tunnel?.service ?? null, edge: target.edge });
    images = override.images;
    const file = overridePath(job, deps);
    deps.writeFile(file, override.yaml);
    const files = [composeFile, file];

    await ensureEdgeNetwork(job, deps);
    await runStep(deps, dockerStep("Walidacja Compose", [...composeArgs(target, files), "config", "-q"], 120_000));
    await runStep(deps, dockerStep("Build", [...composeArgs(target, files), "build"], 45 * 60_000));

    baseline = await captureBaseline(job, liveSha, previous, images, deps);
    // Roll back only to what is live now: the agent's last release when it still
    // matches the checkout, otherwise the snapshot taken above.
    rollbackTarget = previous && liveSha && previous.sha === liveSha ? previous : baseline;

    containersTouched = true;
    const failure = await upAndCheck(job, files, deps);
    if (!failure) {
      return { status: "succeeded", error: null, rolledBackTo: null, release: { sha: job.sha, images, deployedAt: new Date(deps.now()).toISOString() }, baseline, orphanImages: [] };
    }
    return rollbackAfterFailure(job, rollbackTarget, baseline, failure, images, deps);
  } catch (error) {
    return containersTouched ? rollbackAfterFailure(job, rollbackTarget, baseline, describeError(error), images, deps) : failed(describeError(error), baseline);
  }
}

export async function runRollback(job: Job, release: Release, deps: PipelineDeps): Promise<JobOutcome> {
  try {
    const failure = await restoreRelease(job, release, deps);
    if (failure) return failed(`Przywrócona wersja ${release.sha.slice(0, 7)} nie przeszła bramki: ${failure}`);
    return { status: "succeeded", error: null, rolledBackTo: null, release: { ...release, deployedAt: new Date(deps.now()).toISOString() }, baseline: null, orphanImages: [] };
  } catch (error) {
    return failed(describeError(error));
  }
}

export async function runApplyEnv(job: Job, release: Release, envFile: EnvFile, deps: PipelineDeps): Promise<JobOutcome> {
  let filePath: string;
  try {
    filePath = envFilePath(job, envFile.name);
  } catch (error) {
    return failed(describeError(error));
  }
  let changed = false;
  let failure: string;
  try {
    deps.log(`=== Zapis ${envFile.name} ===`);
    deps.replaceFile(filePath, envFile.content);
    changed = true;
    const gateFailure = await restoreRelease(job, release, deps);
    if (!gateFailure) return { status: "succeeded", error: null, rolledBackTo: null, release: null, baseline: null, orphanImages: [] };
    failure = `Nowe zmienne nie przeszły bramki: ${gateFailure}`;
  } catch (error) {
    if (!changed) return failed(describeError(error));
    failure = `Nowe zmienne nie przeszły bramki: ${describeError(error)}`;
  }

  deps.log(`=== Przywracanie poprzedniego ${envFile.name} ===`);
  try {
    if (envFile.previous === null) deps.removeFile(filePath);
    else deps.replaceFile(filePath, envFile.previous);
    const restoreFailure = await restoreRelease(job, release, deps);
    if (restoreFailure) return failed(`${failure}; przywrócenie poprzednich zmiennych też się nie powiodło: ${restoreFailure}`);
    return { status: "rolled_back", error: failure, rolledBackTo: release.sha, release: null, baseline: null, orphanImages: [] };
  } catch (error) {
    return failed(`${failure}; przywrócenie poprzednich zmiennych też się nie powiodło: ${describeError(error)}`);
  }
}
