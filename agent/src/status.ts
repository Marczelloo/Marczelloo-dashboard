import { statfs } from "node:fs/promises";
import { runCommand } from "./exec";
import { parseProjectStatuses } from "./health";
import type { AgentState, AgentStatus, ContainerStatus } from "./types";

const COMMAND_TIMEOUT_MS = 8_000;
const DISK_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 5 * 60_000;
const silent = () => undefined;

type Run = typeof runCommand;
type Statfs = typeof statfs;

export interface StatusDependencies {
  run: Run;
  statfs: Statfs;
  now(): Date;
}

export function parseDockerSize(value: string): number | null {
  const match = /^([0-9]+(?:\.[0-9]+)?)(B|kB|MB|GB|TB)$/.exec(value.trim());
  if (!match) return null;
  const powers: Record<string, number> = { B: 0, kB: 1, MB: 2, GB: 3, TB: 4 };
  const bytes = Number(match[1]) * 1000 ** powers[match[2]];
  return Number.isFinite(bytes) ? bytes : null;
}

function deadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

async function containerStatuses(run: Run): Promise<Record<string, ContainerStatus[]>> {
  try {
    const listed = await deadline(
      run({ label: "docker ps", command: "docker", args: ["ps", "-aq", "--filter", "label=com.docker.compose.project"], timeoutMs: COMMAND_TIMEOUT_MS, quiet: true, allowFailure: true }, silent),
      COMMAND_TIMEOUT_MS
    );
    if (!listed || listed.code !== 0) return {};
    const ids = listed.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!ids.length) return {};
    // docker inspect contains env values: keep the command quiet and only return parsed state fields.
    const inspected = await deadline(
      run({ label: "docker inspect", command: "docker", args: ["inspect", ...ids], timeoutMs: COMMAND_TIMEOUT_MS, quiet: true, allowFailure: true }, silent),
      COMMAND_TIMEOUT_MS
    );
    return inspected?.code === 0 ? parseProjectStatuses(inspected.stdout) : {};
  } catch {
    return {};
  }
}

async function diskStatus(projectsDir: string, getStatfs: Statfs): Promise<AgentStatus["disk"]> {
  try {
    const stats = await deadline(getStatfs(projectsDir), DISK_TIMEOUT_MS);
    return stats ? { path: projectsDir, totalBytes: stats.blocks * stats.bsize, freeBytes: stats.bavail * stats.bsize } : null;
  } catch {
    return null;
  }
}

async function readBuildCache(run: Run): Promise<number | null> {
  try {
    const result = await deadline(
      run({ label: "docker system df", command: "docker", args: ["system", "df", "--format", "{{json .}}"], timeoutMs: COMMAND_TIMEOUT_MS, quiet: true, allowFailure: true }, silent),
      COMMAND_TIMEOUT_MS
    );
    if (!result || result.code !== 0) return null;
    for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
      const row = JSON.parse(line) as { Type?: string; Size?: string };
      if (row.Type === "Build Cache") return typeof row.Size === "string" ? parseDockerSize(row.Size) : null;
    }
  } catch {
    // Status collection is best-effort.
  }
  return null;
}

export function assembleAgentStatus(
  state: AgentState,
  containers: Record<string, ContainerStatus[]>,
  disk: AgentStatus["disk"],
  buildCacheBytes: number | null,
  generatedAt: string
): AgentStatus {
  const names = new Set([...Object.keys(containers), ...Object.keys(state.projects)]);
  for (const job of state.jobs) if (job.status === "queued" || job.status === "running") names.add(job.target.composeProject);
  const projects: AgentStatus["projects"] = {};
  for (const project of [...names].sort()) {
    const projectJobs = state.jobs.filter((job) => job.target.composeProject === project);
    const active = projectJobs.find((job) => job.status === "queued" || job.status === "running");
    const lastFinishedAt = projectJobs.reduce<string | null>(
      (latest, job) => (job.finishedAt && (!latest || job.finishedAt > latest) ? job.finishedAt : latest),
      null
    );
    projects[project] = {
      containers: containers[project] ?? [],
      activeJob: active ? { id: active.id, kind: active.kind, status: active.status } : null,
      lastFinishedAt,
    };
  }
  return { generatedAt, projects, disk, buildCacheBytes };
}

export function createStatusReader(projectsDir: string, dependencies: Partial<StatusDependencies> = {}): (state: AgentState) => Promise<AgentStatus> {
  const run = dependencies.run ?? runCommand;
  const getStatfs = dependencies.statfs ?? statfs;
  const now = dependencies.now ?? (() => new Date());
  let cache: { readAt: number; value: number | null } | null = null;

  return async (state) => {
    const current = now();
    const cachePromise = cache && current.getTime() - cache.readAt < CACHE_TTL_MS
      ? Promise.resolve(cache.value)
      : readBuildCache(run).then((value) => {
          cache = { readAt: current.getTime(), value };
          return value;
        });
    const [containers, disk, buildCacheBytes] = await Promise.all([containerStatuses(run), diskStatus(projectsDir, getStatfs), cachePromise]);
    return assembleAgentStatus(state, containers, disk, buildCacheBytes, current.toISOString());
  };
}
