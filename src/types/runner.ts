// ========================================
// Runner Service Types
// ========================================

export interface RunnerConfig {
  url: string;
  token: string;
}

export type RunnerOperation =
  | "git_pull"
  | "docker_restart"
  | "docker_rebuild"
  | "compose_up"
  | "docker_logs"
  | "docker_status";

export interface RunnerRequest {
  operation: RunnerOperation;
  target: {
    repo_path?: string;
    compose_project?: string;
    container_name?: string;
    service_name?: string;
  };
  options?: {
    tail?: number;
    build?: boolean;
  };
}

export interface RunnerResponse {
  success: boolean;
  operation: RunnerOperation;
  output?: string;
  commit_sha?: string;
  error?: string;
  duration_ms?: number;
  timestamp: string;
}

// Allowed operations whitelist (configured server-side)
export interface RunnerAllowlist {
  repo_paths: string[];
  compose_projects: string[];
  container_names: string[];
}
