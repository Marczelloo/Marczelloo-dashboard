import type { MonitorKind, MonitorStatus, MonitorTarget, Observation, TargetState, Transition } from "./types";

/** Consecutive failed checks before a target is reported down. Slow checks alert on the first one. */
const DOWN_THRESHOLD: Record<MonitorKind, number> = { agent: 2, containers: 2, domain: 2, disk: 1, tls: 1 };

export interface NotificationPayload {
  title: string;
  message: string;
  color: "success" | "warning" | "danger" | "info";
  fields: { name: string; value: string; inline?: boolean }[];
}

/**
 * Applies one observation. While muted (a deploy of the target's project is in
 * progress) the status and failure counter stay put; only detail and the check
 * time move, so restart counters taken during a deploy do not alert later.
 */
export function advance(previous: TargetState | null, target: MonitorTarget, observation: Observation, now: string, options: { muted: boolean }): { state: TargetState; transition: Transition | null } {
  const base: TargetState = previous
    ? { ...previous, label: target.label, projectId: target.projectId, kind: target.kind }
    : { key: target.key, kind: target.kind, label: target.label, projectId: target.projectId, status: "unknown", failCount: 0, since: now, lastCheckedAt: null, lastError: null, detail: {} };
  const checked = { ...base, lastCheckedAt: now, detail: observation.detail };
  if (options.muted) return { state: checked, transition: null };

  let status: MonitorStatus;
  let failCount = 0;
  let lastError: string | null = null;
  if (observation.outcome === "ok") {
    status = "ok";
  } else if (observation.outcome === "warning") {
    status = "warning";
    lastError = observation.reason;
  } else {
    failCount = base.failCount + 1;
    lastError = observation.reason;
    status = failCount >= DOWN_THRESHOLD[target.kind] ? "down" : base.status;
  }

  if (status === base.status) return { state: { ...checked, failCount, lastError }, transition: null };
  const state = { ...checked, status, failCount, lastError, since: now };
  if (base.status === "unknown" && status === "ok") return { state, transition: null };
  return { state, transition: { from: base.status, to: status, reason: lastError, previousSince: base.since } };
}

/** Values that move on every check; saving them each minute would exhaust the AtlasHub rate limit. */
const VOLATILE_DETAIL = new Set(["latencyMs", "generatedAt", "freeBytes", "buildCacheBytes"]);
const HEARTBEAT_MS = 15 * 60 * 1000;

function stableDetail(detail: Record<string, unknown>): string {
  return JSON.stringify(Object.entries(detail).filter(([key]) => !VOLATILE_DETAIL.has(key)).sort(([a], [b]) => a.localeCompare(b)));
}

/** Whether a checked state differs enough from the stored one to be written. */
export function shouldPersist(stored: TargetState | null, next: TargetState, now: string): boolean {
  if (!stored) return true;
  if (stored.status !== next.status || stored.failCount !== next.failCount || stored.lastError !== next.lastError) return true;
  if (stored.label !== next.label || stored.projectId !== next.projectId) return true;
  if (stableDetail(stored.detail) !== stableDetail(next.detail)) return true;
  return !stored.lastCheckedAt || Date.parse(now) - Date.parse(stored.lastCheckedAt) >= HEARTBEAT_MS;
}

const KIND_LABEL: Record<MonitorKind, string> = {
  agent: "Deploy agent",
  disk: "Pi disk",
  containers: "Containers",
  domain: "Domain",
  tls: "Certificate",
};

export function formatDuration(fromIso: string, toIso: string): string {
  const minutes = Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 60_000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export function notificationFor(target: MonitorTarget, transition: Transition, now: string, projectName: string | null): NotificationPayload | null {
  if (transition.from === "unknown" && transition.to === "ok") return null;
  const subject = target.kind === "agent" || target.kind === "disk" ? KIND_LABEL[target.kind] : `${KIND_LABEL[target.kind]} ${target.label}`;
  const fields: NotificationPayload["fields"] = [];
  if (projectName) fields.push({ name: "Project", value: projectName, inline: true });

  if (transition.to === "ok") {
    fields.push({ name: "Duration", value: formatDuration(transition.previousSince, now), inline: true });
    return { title: `✅ ${subject}: back up`, message: transition.from === "warning" ? "Warning resolved." : "Service is responding again.", color: "success", fields };
  }
  if (transition.reason) fields.push({ name: "Reason", value: transition.reason, inline: false });
  if (transition.to === "down") return { title: `🔴 ${subject}: down`, message: "More checks are failing.", color: "danger", fields };
  return { title: `⚠️ ${subject}: warning`, message: "Needs attention but is still running.", color: "warning", fields };
}

/** Incidents span down and warning periods; switching between the two keeps the same incident. */
export function incidentAction(transition: Transition): "open" | "update" | "close" | null {
  const bad = (status: Transition["from"]) => status === "down" || status === "warning";
  if (bad(transition.to)) return bad(transition.from) ? "update" : "open";
  return bad(transition.from) ? "close" : null;
}
