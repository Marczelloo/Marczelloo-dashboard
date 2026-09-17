import type { UptimeState } from "@/components/ui/uptime-strip";
import type { Tone } from "@/lib/tone";
import type { DeployStatus } from "@/types";

export type DeployPhase = "fetch" | "config" | "build" | "start" | "health" | "rollback";

export interface HourBucket {
  start: string;
  state: UptimeState;
}

export type Attention =
  | { kind: "deploying"; jobId: string; phase: DeployPhase | null; startedAt: string | null; sha: string }
  | { kind: "down" | "degraded"; reason: string; since: string; container: { name: string; service: string; status: string; exitCode: number } | null };

export interface FleetRow {
  projectId: string;
  name: string;
  slug: string;
  domain: string | null;
  composeProject: string | null;
  /** Docker service used for restarts. */
  serviceId: string | null;
  tone: Tone;
  uptime: HourBucket[];
  containers: { running: number; total: number } | null;
  lastDeploy: { at: string; sha: string | null; status: DeployStatus } | null;
  attention: Attention | null;
}
