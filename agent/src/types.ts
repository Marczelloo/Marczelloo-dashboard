import type { ContainerSample } from "./health";

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
  tunnel: { hostname: string; localPort: number; probe: boolean; service?: string | null } | null;
  /**
   * Compose file rendered by the dashboard for repositories without their own
   * (built from a template or a plain Dockerfile). Missing in older jobs.
   */
  generatedCompose?: string | null;
  /**
   * Shared Docker network the tunnel connector reaches containers on. Listed
   * services join it in addition to their own networks. Missing in older jobs.
   * joinAll: every service joins too (keeping its ports), so workers without a
   * domain can reach shared services such as AtlasHub by container name.
   */
  edge?: { network: string; services: string[]; dropPorts?: boolean; joinAll?: boolean } | null;
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
  /** Label of the pipeline step running now; null when not running. Missing in older jobs. */
  step?: string | null;
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

export interface ContainerStatus extends ContainerSample {
  oomKilled: boolean;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ProjectStatus {
  containers: ContainerStatus[];
  activeJob: { id: string; kind: string; status: string; step: string | null; sha: string; startedAt: string | null } | null;
  lastFinishedAt: string | null;
}

export interface AgentStatus {
  generatedAt: string;
  projects: Record<string, ProjectStatus>;
  disk: { path: string; totalBytes: number; freeBytes: number } | null;
  buildCacheBytes: number | null;
}

export interface EnvFilesListRequest { repoPath: string }
export interface EnvFilesListResponse { files: string[] }
export interface EnvFilesReadRequest { repoPath: string; filename: string }
export interface EnvFilesReadResponse { exists: boolean; content: string }

export interface PreflightRequest { repoPath: string; composeFile: string | null }
export interface PreflightResponse {
  repoState: "missing" | "git" | "directory";
  composeFile: string | null;
  composeValid: boolean | null;
  services: string[];
  profiles: string[];
  /** TCP ports each service declares (published may be null for container-only ports). */
  ports: Array<{ service: string; published: number | null; target: number }>;
}

export interface PublishedPort {
  container: string;
  hostIp: string;
  hostPort: number;
  containerPort: number;
  protocol: string;
}

export interface HostInfo {
  hostname: string;
  uptimeSeconds: number;
  loadavg: [number, number, number];
  cores: number;
  memory: { totalBytes: number; availableBytes: number };
  disk: { path: string; totalBytes: number; freeBytes: number } | null;
  temperatureC: number | null;
  docker: { running: number; stopped: number; images: number } | null;
  publishedPorts: PublishedPort[];
}

export interface RestartContainerRequest { name: string }
export interface RestartContainerResponse { ok: true }
