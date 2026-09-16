export type MonitorKind = "agent" | "disk" | "containers" | "domain" | "tls";
export type MonitorStatus = "unknown" | "ok" | "warning" | "down";

export interface MonitorTarget {
  key: string;
  kind: MonitorKind;
  label: string;
  projectId: string | null;
  /** Compose project whose deploys mute this target. */
  composeProject: string | null;
  host: string | null;
}

/** Result of one check; `detail` is kept even when the outcome is ignored (muted). */
export type Observation =
  | { outcome: "ok"; detail: Record<string, unknown> }
  | { outcome: "warning" | "fail"; reason: string; detail: Record<string, unknown> };

export interface TargetState {
  key: string;
  kind: MonitorKind;
  label: string;
  projectId: string | null;
  status: MonitorStatus;
  failCount: number;
  /** When the current status started. */
  since: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  detail: Record<string, unknown>;
}

export interface Transition {
  from: MonitorStatus;
  to: MonitorStatus;
  reason: string | null;
  /** Start of the previous status, for "down for 12 min" messages. */
  previousSince: string;
}
