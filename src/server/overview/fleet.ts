import type { ProjectStatus } from "@agent/types";
import type { Tone } from "@/lib/tone";
import type { TargetState } from "@/server/monitoring/types";
import { deployPhase } from "./phases";
import type { Attention, FleetRow } from "./types";

export function attentionFor({ agent, states }: { agent: ProjectStatus | null; states: TargetState[] }): Attention | null {
  const job = agent?.activeJob;
  if (job) return { kind: "deploying", jobId: job.id, phase: deployPhase(job.step), startedAt: job.startedAt, sha: job.sha };

  const failing = states.find((target) => target.status === "down") ?? states.find((target) => target.status === "warning");
  if (!failing) return null;

  const stopped = agent?.containers.find((container) => container.status !== "running");
  return {
    kind: failing.status === "down" ? "down" : "degraded",
    reason: failing.lastError ?? (failing.status === "down" ? "Down" : "Degraded"),
    since: failing.since,
    container: stopped ? { name: stopped.name, service: stopped.service, status: stopped.status, exitCode: stopped.exitCode } : null,
  };
}

export function toneFor(attention: Attention | null, monitored: boolean): Tone {
  if (attention?.kind === "deploying") return "live";
  if (attention?.kind === "down") return "err";
  if (attention?.kind === "degraded") return "warn";
  return monitored ? "ok" : "idle";
}

const WEIGHT: Record<Attention["kind"] | "none", number> = { deploying: 0, down: 1, degraded: 2, none: 3 };

export function rankFleet(rows: FleetRow[]): FleetRow[] {
  return [...rows].sort((a, b) => WEIGHT[a.attention?.kind ?? "none"] - WEIGHT[b.attention?.kind ?? "none"] || a.name.localeCompare(b.name));
}
