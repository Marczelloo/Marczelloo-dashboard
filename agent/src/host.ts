import { lstat, readFile, readdir, realpath, stat, statfs } from "node:fs/promises";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "./exec";
import type { CommandStep } from "./git";
import type {
  EnvFilesListResponse,
  EnvFilesReadResponse,
  HostInfo,
  PreflightResponse,
  RestartContainerResponse,
} from "./types";

const ENV_FILE = /^\.env(?:\.[A-Za-z0-9_-]+)?$/;
const COMPOSE_FILE = /^[A-Za-z0-9][A-Za-z0-9_./-]*$/;
const CONTAINER_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const COMPOSE_CANDIDATES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
const MAX_ENV_BYTES = 1024 * 1024;
const COMMAND_TIMEOUT_MS = 20_000;
const HOST_COMMAND_TIMEOUT_MS = 12_000;
const silent = () => undefined;

type Run = typeof runCommand;
type Realpath = (target: string) => Promise<string>;

export class HostOperationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface HostOperations {
  listEnvFiles(input: unknown): Promise<EnvFilesListResponse>;
  readEnvFile(input: unknown): Promise<EnvFilesReadResponse>;
  preflight(input: unknown): Promise<PreflightResponse>;
  getHostInfo(): Promise<HostInfo>;
  restartContainer(input: unknown): Promise<RestartContainerResponse>;
}

export interface HostDependencies {
  run: Run;
  readFile: typeof readFile;
  readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
  lstat: typeof lstat;
  realpath: Realpath;
  stat: typeof stat;
  statfs: typeof statfs;
  hostname(): string;
  uptime(): number;
  loadavg(): number[];
  cpus(): unknown[];
  totalmem(): number;
  freemem(): number;
  env: NodeJS.ProcessEnv;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.posix.relative(root, candidate);
  return relative === "" || (!relative.startsWith("../") && relative !== ".." && !path.posix.isAbsolute(relative));
}

/** Pure lexical validation performed before any filesystem access. */
export function validateRepoPathInput(repoPath: unknown, allowedRoot: string): string {
  if (typeof repoPath !== "string" || !path.posix.isAbsolute(repoPath) || repoPath.split("/").includes("..")) {
    throw new HostOperationError("Nieprawidłowa ścieżka repozytorium.");
  }
  const normalizedRoot = path.posix.resolve(allowedRoot);
  const normalizedRepo = path.posix.resolve(repoPath);
  if (!isInside(normalizedRoot, normalizedRepo)) throw new HostOperationError("Repozytorium musi leżeć w katalogu projektów.");
  return normalizedRepo;
}

/** Apply realpath validation as a second barrier when the repository exists. */
export async function validateRepoPath(repoPath: unknown, allowedRoot: string, getRealpath: Realpath = realpath): Promise<string> {
  const normalizedRepo = validateRepoPathInput(repoPath, allowedRoot);
  const normalizedRoot = path.posix.resolve(allowedRoot);

  let realRoot = normalizedRoot;
  try {
    realRoot = await getRealpath(normalizedRoot);
  } catch {
    // The configured root is checked lexically if it is not present yet.
  }
  try {
    const realRepo = await getRealpath(normalizedRepo);
    if (!isInside(realRoot, realRepo)) throw new HostOperationError("Repozytorium musi leżeć w katalogu projektów.");
    return realRepo;
  } catch (error) {
    if (error instanceof HostOperationError) throw error;
    if (!isMissing(error)) throw new HostOperationError("Nie można sprawdzić ścieżki repozytorium.");
    return normalizedRepo;
  }
}

export function validateEnvFilename(filename: unknown): string {
  if (typeof filename !== "string" || !ENV_FILE.test(filename)) throw new HostOperationError("Nieprawidłowa nazwa pliku środowiskowego.");
  return filename;
}

export function validateComposeFilename(composeFile: unknown): string | null {
  if (composeFile === null) return null;
  if (
    typeof composeFile !== "string" ||
    !COMPOSE_FILE.test(composeFile) ||
    path.posix.isAbsolute(composeFile) ||
    composeFile.split("/").includes("..")
  ) {
    throw new HostOperationError("Nieprawidłowa ścieżka pliku Compose.");
  }
  return composeFile;
}

export function parseMeminfo(content: string): { totalBytes: number; availableBytes: number } | null {
  const values = new Map<string, number>();
  for (const line of content.split(/\r?\n/)) {
    const match = /^(MemTotal|MemAvailable):\s+(\d+)\s+kB\s*$/.exec(line);
    if (match) values.set(match[1], Number(match[2]) * 1024);
  }
  const totalBytes = values.get("MemTotal");
  const availableBytes = values.get("MemAvailable");
  return totalBytes === undefined || availableBytes === undefined ? null : { totalBytes, availableBytes };
}

export function parsePublishedPorts(output: string): HostInfo["publishedPorts"] {
  const result: HostInfo["publishedPorts"] = [];
  const seen = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab < 1) continue;
    const container = line.slice(0, tab).trim();
    for (const entry of line.slice(tab + 1).split(",").map((item) => item.trim())) {
      const match = /^(\[[^\]]+\]|[^:]+):(\d+)(?:-(\d+))?->(\d+)(?:-(\d+))?\/([A-Za-z0-9]+)$/.exec(entry);
      if (!match) continue;
      const hostIp = match[1].startsWith("[") ? match[1].slice(1, -1) : match[1];
      const hostStart = Number(match[2]);
      const hostEnd = Number(match[3] ?? match[2]);
      const containerStart = Number(match[4]);
      const containerEnd = Number(match[5] ?? match[4]);
      const length = Math.min(hostEnd - hostStart, containerEnd - containerStart);
      if (length < 0) continue;
      for (let offset = 0; offset <= length; offset += 1) {
        const port = { container, hostIp, hostPort: hostStart + offset, containerPort: containerStart + offset, protocol: match[6] };
        const key = `${port.container}\0${port.hostIp}\0${port.hostPort}\0${port.containerPort}\0${port.protocol}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(port);
        }
      }
    }
  }
  return result;
}

function lineCount(value: string): number {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
}

function deadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); }
    );
  });
}

function command(label: string, args: string[], timeoutMs = COMMAND_TIMEOUT_MS): CommandStep {
  return { label, command: "docker", args, timeoutMs, quiet: true, allowFailure: true };
}

export function createHostOperations(allowedRoot: string, dependencies: Partial<HostDependencies> = {}): HostOperations {
  const deps: HostDependencies = {
    run: dependencies.run ?? runCommand,
    readFile: dependencies.readFile ?? readFile,
    readdir: dependencies.readdir ?? readdir,
    lstat: dependencies.lstat ?? lstat,
    realpath: dependencies.realpath ?? realpath,
    stat: dependencies.stat ?? stat,
    statfs: dependencies.statfs ?? statfs,
    hostname: dependencies.hostname ?? os.hostname,
    uptime: dependencies.uptime ?? os.uptime,
    loadavg: dependencies.loadavg ?? os.loadavg,
    cpus: dependencies.cpus ?? os.cpus,
    totalmem: dependencies.totalmem ?? os.totalmem,
    freemem: dependencies.freemem ?? os.freemem,
    env: dependencies.env ?? process.env,
  };

  async function checkedRepo(input: unknown): Promise<string> {
    const repoPath = (input as { repoPath?: unknown } | null)?.repoPath;
    return validateRepoPath(repoPath, allowedRoot, deps.realpath);
  }

  return {
    async listEnvFiles(input: unknown) {
      const repoPath = await checkedRepo(input);
      try {
        const entries = await deps.readdir(repoPath, { withFileTypes: true });
        return { files: entries.filter((entry) => entry.isFile() && ENV_FILE.test(entry.name)).map((entry) => entry.name).sort() };
      } catch (error) {
        if (isMissing(error)) return { files: [] };
        throw new HostOperationError("Nie można odczytać katalogu repozytorium.");
      }
    },

    async readEnvFile(input: unknown) {
      const repoPath = await checkedRepo(input);
      const filename = validateEnvFilename((input as { filename?: unknown } | null)?.filename);
      const target = path.posix.join(repoPath, filename);
      try {
        const info = await deps.lstat(target);
        if (!info.isFile()) return { exists: false, content: "" };
        if (info.size > MAX_ENV_BYTES) throw new HostOperationError("Plik środowiskowy jest zbyt duży.", 413);
        const data = await deps.readFile(target);
        if (data.length > MAX_ENV_BYTES) throw new HostOperationError("Plik środowiskowy jest zbyt duży.", 413);
        return { exists: true, content: data.toString("utf8") };
      } catch (error) {
        if (error instanceof HostOperationError) throw error;
        if (isMissing(error)) return { exists: false, content: "" };
        throw new HostOperationError("Nie można odczytać pliku środowiskowego.");
      }
    },

    async preflight(input: unknown) {
      const repoPath = await checkedRepo(input);
      const requested = validateComposeFilename((input as { composeFile?: unknown } | null)?.composeFile);
      let repoState: PreflightResponse["repoState"] = "missing";
      try {
        const repoInfo = await deps.stat(repoPath);
        if (repoInfo.isDirectory()) {
          repoState = "directory";
          try { await deps.stat(path.posix.join(repoPath, ".git")); repoState = "git"; } catch { /* not a Git work tree */ }
        }
      } catch (error) {
        if (!isMissing(error)) throw new HostOperationError("Nie można sprawdzić repozytorium.");
      }

      let composeFile: string | null = null;
      let composeAbsolute: string | null = null;
      const candidates = requested === null ? COMPOSE_CANDIDATES : [requested];
      for (const candidate of candidates) {
        try {
          const target = path.posix.join(repoPath, candidate);
          const resolved = await deps.realpath(target);
          if (!isInside(repoPath, resolved)) throw new HostOperationError("Plik Compose musi leżeć w repozytorium.");
          if ((await deps.stat(resolved)).isFile()) { composeFile = candidate; composeAbsolute = resolved; break; }
        } catch (error) {
          if (error instanceof HostOperationError) throw error;
          if (!isMissing(error)) throw new HostOperationError("Nie można sprawdzić pliku Compose.");
        }
      }
      if (!composeFile || !composeAbsolute) return { repoState, composeFile: null, composeValid: null, services: [], profiles: [] };

      const base = ["compose", "--project-directory", repoPath, "-f", composeAbsolute, "config"];
      const [valid, services, profiles] = await Promise.all([
        deps.run(command("docker compose config", [...base, "-q"]), silent),
        deps.run(command("docker compose services", [...base, "--services"]), silent),
        deps.run(command("docker compose profiles", [...base, "--profiles"]), silent),
      ]);
      return {
        repoState,
        composeFile,
        composeValid: valid.code === 0,
        services: services.code === 0 ? services.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [],
        profiles: profiles.code === 0 ? profiles.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [],
      };
    },

    async getHostInfo() {
      const fallbackMemory = { totalBytes: deps.totalmem(), availableBytes: deps.freemem() };
      const hostnamePromise = (async () => {
        const configured = deps.env.HOST_HOSTNAME?.trim();
        if (configured) return configured;
        try { const mounted = (await deps.readFile("/etc/host-hostname", "utf8")).trim(); if (mounted) return mounted; } catch { /* fallback */ }
        return deps.hostname();
      })();
      const memoryPromise = deps.readFile("/proc/meminfo", "utf8").then(parseMeminfo).then((value) => value ?? fallbackMemory).catch(() => fallbackMemory);
      const diskPromise = deps.statfs(allowedRoot).then((value) => ({ path: allowedRoot, totalBytes: value.blocks * value.bsize, freeBytes: value.bavail * value.bsize })).catch(() => null);
      const temperaturePromise = deps.readFile("/sys/class/thermal/thermal_zone0/temp", "utf8").then((value) => {
        const raw = Number(value.trim());
        return Number.isFinite(raw) ? Math.round(raw / 100) / 10 : null;
      }).catch(() => null);
      const dockerRuns = [
        deps.run(command("docker running", ["ps", "-q"], HOST_COMMAND_TIMEOUT_MS), silent),
        deps.run(command("docker stopped", ["ps", "-aq", "--filter", "status=exited"], HOST_COMMAND_TIMEOUT_MS), silent),
        deps.run(command("docker images", ["images", "-q"], HOST_COMMAND_TIMEOUT_MS), silent),
      ];
      const dockerPromise = Promise.all(dockerRuns).then(([running, stopped, images]) =>
        [running, stopped, images].every((item) => item.code === 0)
          ? { running: lineCount(running.stdout), stopped: lineCount(stopped.stdout), images: lineCount(images.stdout) }
          : null
      ).catch(() => null);
      const portsPromise = deps.run(command("docker published ports", ["ps", "--format", "{{.Names}}\t{{.Ports}}"], HOST_COMMAND_TIMEOUT_MS), silent)
        .then((value) => value.code === 0 ? parsePublishedPorts(value.stdout) : []).catch(() => []);

      const [hostname, memory, disk, temperatureC, docker, publishedPorts] = await Promise.all([
        deadline(hostnamePromise, 14_500).then((value) => value ?? deps.hostname()),
        deadline(memoryPromise, 14_500).then((value) => value ?? fallbackMemory),
        deadline(diskPromise, 14_500).then((value) => value ?? null),
        deadline(temperaturePromise, 14_500).then((value) => value ?? null),
        deadline(dockerPromise, 14_500).then((value) => value ?? null),
        deadline(portsPromise, 14_500).then((value) => value ?? []),
      ]);
      const load = deps.loadavg();
      return {
        hostname,
        uptimeSeconds: deps.uptime(),
        loadavg: [load[0] ?? 0, load[1] ?? 0, load[2] ?? 0],
        cores: deps.cpus().length,
        memory,
        disk,
        temperatureC,
        docker,
        publishedPorts,
      };
    },

    async restartContainer(input: unknown) {
      const name = (input as { name?: unknown } | null)?.name;
      if (typeof name !== "string" || !CONTAINER_NAME.test(name)) throw new HostOperationError("Nieprawidłowa nazwa kontenera.");
      if (name === "marczelloo-agent") throw new HostOperationError("Nie można zrestartować kontenera agenta.");
      const inspected = await deps.run(command("docker inspect compose project", ["inspect", "--format", "{{index .Config.Labels \"com.docker.compose.project\"}}", name]), silent);
      if (inspected.code !== 0 || !inspected.stdout.trim()) throw new HostOperationError("Nie znaleziono zarządzanego kontenera.", 404);
      const restarted = await deps.run(command("docker restart", ["restart", "--time", "30", name], 90_000), silent);
      if (restarted.code !== 0) throw new HostOperationError("Nie udało się zrestartować kontenera.");
      return { ok: true };
    },
  };
}
