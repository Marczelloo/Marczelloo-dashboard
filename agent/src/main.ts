import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchCloneToken } from "./dashboard";
import { probe, sampleContainers, serviceImages } from "./docker";
import { runCommand } from "./exec";
import { buildCacheLimit, collectableImages, imageRepository } from "./gc";
import { runApplyEnv, runDeploy, runRollback, type PipelineDeps } from "./pipeline";
import { acknowledgeEvents, finishJob, nextJob, recoverAfterRestart, startJob, type JobOutcome } from "./queue";
import { deliverEvents, httpEventSender } from "./reporter";
import { createAgentServer } from "./server";
import { FileStore } from "./store";
import { createStatusReader } from "./status";
import type { AgentState, EnvFile, Job } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const agentToken = requireEnv("AGENT_TOKEN");
if (agentToken.length < 32) throw new Error("AGENT_TOKEN must have at least 32 characters");
const projectsDir = requireEnv("PROJECTS_DIR").replace(/\/+$/, "");
const dashboardUrl = requireEnv("DASHBOARD_URL").replace(/\/+$/, "");
const eventsUrl = `${dashboardUrl}/api/agent/events`;
const dataDir = process.env.AGENT_DATA_DIR || path.posix.join(projectsDir, ".dashboard", "agent");
const port = Number(process.env.AGENT_PORT || 8790);
const buildCacheMax = buildCacheLimit(process.env.AGENT_BUILD_CACHE_MAX);

const store = new FileStore(dataDir);
const overrideDir = path.posix.join(dataDir, "overrides");
mkdirSync(overrideDir, { recursive: true, mode: 0o700 });

const iso = () => new Date().toISOString();
let state: AgentState = recoverAfterRestart(store.load(), iso());
store.save(state);
const tokens = new Map<string, string | null>();
const envFiles = new Map<string, EnvFile>();
const mutate = (change: (current: AgentState) => AgentState) => {
  state = change(state);
  store.save(state);
};

const getStatus = createStatusReader(projectsDir);
createAgentServer({ token: agentToken, allowedRoot: projectsDir, getState: () => state, mutate, store, tokens, envFiles, now: iso, newId: randomUUID, getStatus }).listen(port, "0.0.0.0", () => {
  console.log(`[agent] listening on :${port}, data in ${dataDir}`);
});

async function removeImages(images: string[]) {
  let removed = 0;
  for (const image of images) {
    const result = await runCommand({ label: "docker image rm", command: "docker", args: ["image", "rm", image], timeoutMs: 60_000, quiet: true, allowFailure: true }, () => undefined);
    if (result.code === 0) removed += 1;
  }
  return removed;
}

async function dockerOutput(label: string, args: string[]): Promise<string[]> {
  const result = await runCommand({ label, command: "docker", args, timeoutMs: 60_000, quiet: true, allowFailure: true }, () => undefined);
  return result.code === 0 ? result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
}

async function cleanUp(job: Job, before: string[], after: string[], orphanImages: string[]): Promise<void> {
  let removed = 0;
  try {
    const repositories = new Set([...before, ...after, ...orphanImages].map(imageRepository).filter((repository): repository is string => repository !== null));
    const tags = (await Promise.all([...repositories].map((repository) => dockerOutput("docker image ls", ["image", "ls", "--format", "{{.Repository}}:{{.Tag}}", repository])))).flat();
    const inUse = await dockerOutput("docker ps", ["ps", "-a", "--format", "{{.Image}}"]);
    const images = [...new Set([...collectableImages({ repositories, tags, kept: after, inUse }), ...orphanImages])];
    removed = await removeImages(images);
  } catch {
    // Cleanup is best-effort and must not affect a completed job.
  }
  try {
    await runCommand({ label: "docker image prune", command: "docker", args: ["image", "prune", "-f"], timeoutMs: 60_000, quiet: true, allowFailure: true }, () => undefined);
    if (job.kind === "deploy") {
      await runCommand({ label: "docker builder prune", command: "docker", args: ["builder", "prune", "-f", "--max-used-space", buildCacheMax], timeoutMs: 60_000, quiet: true, allowFailure: true }, () => undefined);
    }
  } catch {
    // Cleanup is best-effort and must not affect a completed job.
  }
  store.appendLog(job.id, `[agent] Sprzątanie: usunięto ${removed} obrazów\n`);
}

async function execute(job: Job): Promise<JobOutcome> {
  const log = (line: string) => store.appendLog(job.id, line.endsWith("\n") ? line : `${line}\n`);
  const deps: PipelineDeps = {
    run: (step) => runCommand(step, (chunk) => store.appendLog(job.id, chunk)),
    exists: existsSync,
    writeFile: (file, content) => writeFileSync(file, content, { mode: 0o600 }),
    replaceFile: (file, content) => {
      mkdirSync(path.posix.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = path.posix.join(path.posix.dirname(file), `.${path.posix.basename(file)}.${randomUUID()}.tmp`);
      try {
        writeFileSync(temporary, content, { mode: 0o600 });
        renameSync(temporary, file);
      } catch (error) {
        if (existsSync(temporary)) unlinkSync(temporary);
        throw error;
      }
    },
    removeFile: (file) => {
      if (existsSync(file)) unlinkSync(file);
    },
    sampleContainers,
    serviceImages,
    probe,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log,
    now: Date.now,
    overrideDir,
    gate: { stableMs: 30_000, timeoutMs: 180_000, intervalMs: 5_000, probeTimeoutMs: 60_000 },
  };
  log(`[agent] ${job.kind} ${job.target.composeProject} @ ${job.sha} (${job.triggeredBy})`);
  const releases = state.projects[job.target.composeProject]?.releases ?? [];
  if (job.kind === "deploy") {
    // Prefer a fresh token: the one sent with the request expires after an hour and is lost on restart.
    const token = (await fetchCloneToken(dashboardUrl, agentToken, job.target.projectId)) ?? tokens.get(job.id) ?? null;
    return runDeploy(job, token, releases[0] ?? null, deps);
  }
  if (job.kind === "apply-env") {
    const envFile = envFiles.get(job.id);
    if (!envFile) {
      return { status: "failed", error: "Treść zmiennych została utracona po restarcie agenta — zapisz zmienne ponownie.", rolledBackTo: null, release: null, baseline: null, orphanImages: [] };
    }
    const release = releases.find((candidate) => candidate.sha === job.sha);
    if (!release) return { status: "failed", error: "Wydanie do przywrócenia zniknęło z historii agenta.", rolledBackTo: null, release: null, baseline: null, orphanImages: [] };
    return runApplyEnv(job, release, envFile, deps);
  }
  const release = releases.find((candidate) => candidate.sha === job.sha);
  if (!release) return { status: "failed", error: "Wydanie do przywrócenia zniknęło z historii agenta.", rolledBackTo: null, release: null, baseline: null, orphanImages: [] };
  return runRollback(job, release, deps);
}

let working = false;
async function work() {
  if (working) return;
  const job = nextJob(state);
  if (!job) return;
  working = true;
  try {
    mutate((current) => startJob(current, job.id, iso()));
    const before = state.projects[job.target.composeProject]?.releases ?? [];
    let outcome: JobOutcome;
    try {
      outcome = await execute(job);
    } catch (error) {
      outcome = { status: "failed", error: `Błąd wewnętrzny agenta: ${error instanceof Error ? error.message : String(error)}`, rolledBackTo: null, release: null, baseline: null, orphanImages: [] };
    }
    store.appendLog(job.id, `[agent] Wynik: ${outcome.status}${outcome.error ? ` — ${outcome.error}` : ""}\n`);
    mutate((current) => finishJob(current, job.id, outcome, iso()));
    tokens.delete(job.id);
    envFiles.delete(job.id);
    try {
      store.pruneLogs(new Set(state.jobs.map((item) => item.id)));
    } catch {
      // A log retention failure must not interrupt the agent queue.
    }
    const after = state.projects[job.target.composeProject]?.releases ?? [];
    await cleanUp(job, before.flatMap((release) => Object.values(release.images)), after.flatMap((release) => Object.values(release.images)), outcome.orphanImages);
  } finally {
    tokens.delete(job.id);
    envFiles.delete(job.id);
    working = false;
  }
}

const sendEvent = httpEventSender(eventsUrl, agentToken);
let reporting = false;
async function report() {
  if (reporting || !state.outbox.length) return;
  reporting = true;
  try {
    const delivered = await deliverEvents(state.outbox, sendEvent);
    if (delivered.length) mutate((current) => acknowledgeEvents(current, delivered));
  } finally {
    reporting = false;
  }
}

setInterval(() => void work(), 2_000);
setInterval(() => void report(), 5_000);
