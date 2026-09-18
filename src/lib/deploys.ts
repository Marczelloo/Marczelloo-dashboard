import type { DeployStatus } from "@/types";

export interface DeployRow {
  id: string;
  status: DeployStatus;
  serviceId: string;
  serviceName: string | null;
  projectId: string | null;
  projectName: string | null;
  commitSha: string | null;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  /** Reference the agent log is read by; absent for deploys from the old engine. */
  logsKey: string | null;
  /** The step the agent is on, when this deploy is the one it is running. */
  step: string | null;
}

export interface DeployList {
  generatedAt: string;
  rows: DeployRow[];
  projects: Array<{ id: string; name: string }>;
  /** Deploys the agent is working on right now. */
  running: number;
  last7d: { total: number; failed: number };
}

export const formatDeployDuration = (ms: number | null): string => {
  if (ms === null || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};
