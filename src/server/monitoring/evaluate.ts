import type { AgentStatus, ContainerStatus } from "@agent/types";
import type { Observation } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateDomain(result: { statusCode: number | null; latencyMs: number; error: string | null }): Observation {
  const detail = { statusCode: result.statusCode, latencyMs: result.latencyMs };
  if (result.statusCode === null) return { outcome: "fail", reason: result.error ?? "Brak odpowiedzi", detail };
  // Cloudflare Access answers 302 and apps may answer 4xx for "/": the origin is reachable either way.
  if (result.statusCode < 500) return { outcome: "ok", detail };
  const reason = result.statusCode === 530 || result.statusCode === 1033 ? `HTTP ${result.statusCode} (Cloudflare nie łączy się z Pi)` : `HTTP ${result.statusCode}`;
  return { outcome: "fail", reason, detail };
}

export function evaluateContainers(containers: ContainerStatus[], previousRestarts: Record<string, number> | undefined): Observation {
  const detail = {
    restarts: Object.fromEntries(containers.map((container) => [container.name, container.restartCount])),
    containers: containers.map(({ name, status, health, restartCount }) => ({ name, status, health, restartCount })),
  };
  if (!containers.length) return { outcome: "fail", reason: "Projekt nie ma żadnych kontenerów.", detail };

  const problems: string[] = [];
  for (const container of containers) {
    const before = previousRestarts?.[container.name];
    if (container.oomKilled && container.status !== "running") problems.push(`${container.name} zabity przez brak pamięci (OOM)`);
    else if (container.status === "exited" && container.exitCode !== 0) problems.push(`${container.name} zakończył działanie z kodem ${container.exitCode}`);
    else if (container.status === "dead" || container.status === "restarting") problems.push(`${container.name} jest w stanie ${container.status}`);
    else if (container.health === "unhealthy") problems.push(`${container.name} zgłasza unhealthy`);
    else if (before !== undefined && container.restartCount > before) problems.push(`${container.name} zrestartował się (${container.restartCount - before}× od ostatniego sprawdzenia)`);
  }
  return problems.length ? { outcome: "fail", reason: problems.join("; "), detail } : { outcome: "ok", detail };
}

export function evaluateTls(result: { validTo: string | null; error: string | null }, now: Date): Observation {
  if (!result.validTo) return { outcome: "fail", reason: `Nie udało się sprawdzić certyfikatu: ${result.error ?? "brak certyfikatu"}`, detail: {} };
  const validTo = new Date(result.validTo);
  const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / DAY_MS);
  const detail = { daysLeft, validTo: validTo.toISOString() };
  if (validTo.getTime() <= now.getTime()) return { outcome: "fail", reason: "Certyfikat wygasł", detail };
  if (daysLeft <= 3) return { outcome: "fail", reason: `Certyfikat wygasa za ${daysLeft} dni`, detail };
  if (daysLeft <= 14) return { outcome: "warning", reason: `Certyfikat wygasa za ${daysLeft} dni`, detail };
  return { outcome: "ok", detail };
}

export function evaluateDisk(disk: NonNullable<AgentStatus["disk"]>, buildCacheBytes: number | null): Observation {
  const freePercent = disk.totalBytes > 0 ? Math.round((disk.freeBytes / disk.totalBytes) * 100) : 0;
  const detail = { totalBytes: disk.totalBytes, freeBytes: disk.freeBytes, freePercent, buildCacheBytes };
  const reason = `Wolne ${freePercent}% dysku (${(disk.freeBytes / 1_000_000_000).toFixed(1)} GB)`;
  if (freePercent < 5) return { outcome: "fail", reason, detail };
  if (freePercent < 10) return { outcome: "warning", reason, detail };
  return { outcome: "ok", detail };
}
