export type JobKind = "deploy" | "rollback" | "apply-env";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "rolled_back" | "superseded";

export interface DeployTarget {
  projectId: string;
  composeProject: string;
  repoPath: string;
  githubUrl: string;
  branch: string;
  composeFile: string | null;
  profiles: string[];
  /**
   * probe: the Cloudflare route already points at localPort, so the public
   * hostname can be part of the health gate.
   */
  tunnel: { hostname: string; localPort: number; probe: boolean } | null;
}

export interface Job {
  id: string;
  kind: JobKind;
  target: DeployTarget;
  /** deploy: commit to build; rollback: commit whose images are restored */
  sha: string;
  deployId: string;
  triggeredBy: string;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  rolledBackTo: string | null;
}

export interface Release {
  sha: string;
  /** Compose service name → image reference built for this commit */
  images: Record<string, string>;
  deployedAt: string;
}

/** Kept in memory only; it must never become part of Job or AgentState. */
export interface EnvFile {
  name: string;
  content: string;
  previous: string | null;
}

export interface ProjectState {
  /** Newest first. */
  releases: Release[];
}

export interface AgentEvent {
  /** Deterministic (`<jobId>:started` / `<jobId>:finished`) so redelivery is idempotent. */
  id: string;
  type: "job.started" | "job.finished";
  jobId: string;
  deployId: string;
  projectId: string;
  composeProject: string;
  kind: JobKind;
  sha: string;
  status: JobStatus;
  error: string | null;
  rolledBackTo: string | null;
  at: string;
}

export interface AgentState {
  jobs: Job[];
  projects: Record<string, ProjectState>;
  outbox: AgentEvent[];
}
