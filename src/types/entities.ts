// ========================================
// Database Entity Types
// ========================================

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  tags: string[];
  technologies: string[];
  github_url: string | null;
  prod_url: string | null;
  vercel_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = "active" | "inactive" | "archived" | "maintenance";

export interface Service {
  id: string;
  project_id: string | null;
  name: string;
  type: ServiceType;
  url: string | null;
  health_url: string | null;
  portainer_endpoint_id: number | null;
  container_id: string | null;
  stack_id: number | null;
  repo_path: string | null;
  compose_project: string | null;
  deploy_strategy: DeployStrategy;
  created_at: string;
  updated_at: string;
}

export type ServiceType = "docker" | "vercel" | "external";
export type DeployStrategy = "pull_restart" | "pull_rebuild" | "compose_up" | "manual";

export interface WorkItem {
  id: string;
  project_id: string;
  type: WorkItemType;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  labels: string[];
  github_issue_number: number | null;
  github_pr_number: number | null;
  created_at: string;
  updated_at: string;
}

export type WorkItemType = "todo" | "bug" | "change";
export type WorkItemStatus = "open" | "in_progress" | "done" | "blocked";
export type WorkItemPriority = "low" | "medium" | "high" | "critical";

export interface EnvVar {
  id: string;
  service_id: string;
  key: string;
  value_encrypted: string;
  is_secret: boolean;
  updated_at: string;
}

export interface Deploy {
  id: string;
  service_id: string;
  started_at: string;
  finished_at: string | null;
  status: DeployStatus;
  commit_sha: string | null;
  logs_object_key: string | null;
  triggered_by: string;
  error_message: string | null;
}

export type DeployStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface UptimeCheck {
  id: string;
  service_id: string;
  checked_at: string;
  status_code: number | null;
  latency_ms: number | null;
  ssl_days_left: number | null;
  ok: boolean;
  error: string | null;
}

export interface AuditLog {
  id: string;
  at: string;
  actor_email: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string | null;
  meta_json: Record<string, unknown> | null;
}

export interface PackageUpdate {
  id: string;
  project_id: string;
  ecosystem: PackageEcosystem;
  packages_updated: string[]; // JSON array of package names
  old_versions: Record<string, string>; // JSON: {"react": "19.0.0", ...}
  new_versions: Record<string, string>; // JSON: {"react": "19.0.1", ...}
  status: PackageUpdateStatus;
  test_output: string | null;
  error_message: string | null;
  branch_name: string | null; // feature branch for GitHub projects
  pr_url: string | null; // created PR URL
  rollback_data: string | null; // backed up lockfile content (JSON)
  rollback_from_id: string | null; // ID of the update this rollback reverses (if this is a rollback)
  created_at: string;
  completed_at: string | null;
}

export type PackageEcosystem = "npm" | "yarn" | "pnpm" | "pip" | "poetry" | "cargo" | "composer";
export type PackageUpdateStatus = "pending" | "success" | "failed" | "rolled_back";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "deploy"
  | "restart"
  | "stop"
  | "start"
  | "reveal_secret"
  | "login"
  | "pin_verify"
  | "docker_exec"
  | "docker_exec_blocked"
  | "clear_deploys"
  | "github_sync"
  | "github_webhook_trigger"
  | "github_deploy"
  | "link"
  | "unlink"
  | "sync"
  | "import"
  | "rollback";

export type EntityType =
  | "project"
  | "service"
  | "work_item"
  | "env_var"
  | "deploy"
  | "container"
  | "auth"
  | "github_repo"
  | "release"
  | "github_issue"
  | "work_item_pr"
  | "work_item_github"
  | "github_repos"
  | "package_update";

// ========================================
// Create/Update DTOs
// ========================================

export interface CreateProjectInput {
  name: string;
  slug: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string[];
  technologies?: string[];
  github_url?: string;
  prod_url?: string;
  vercel_url?: string;
  notes?: string;
}

export interface UpdateProjectInput {
  name?: string;
  slug?: string;
  description?: string | null;
  status?: ProjectStatus;
  tags?: string[];
  technologies?: string[];
  github_url?: string | null;
  prod_url?: string | null;
  vercel_url?: string | null;
  notes?: string | null;
}

export interface CreateServiceInput {
  project_id?: string;
  name: string;
  type: ServiceType;
  url?: string;
  health_url?: string;
  portainer_endpoint_id?: number;
  container_id?: string;
  stack_id?: number;
  repo_path?: string;
  compose_project?: string;
  deploy_strategy?: DeployStrategy;
}

export interface UpdateServiceInput {
  name?: string;
  type?: ServiceType;
  url?: string | null;
  health_url?: string | null;
  portainer_endpoint_id?: number | null;
  container_id?: string | null;
  stack_id?: number | null;
  repo_path?: string | null;
  compose_project?: string | null;
  deploy_strategy?: DeployStrategy;
}

export interface CreateWorkItemInput {
  project_id: string;
  type: WorkItemType;
  title: string;
  description?: string;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  labels?: string[];
}

export interface UpdateWorkItemInput {
  type?: WorkItemType;
  title?: string;
  description?: string | null;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  labels?: string[];
  github_issue_number?: number | null;
  github_pr_number?: number | null;
}

export interface CreateEnvVarInput {
  service_id: string;
  key: string;
  value: string;
  is_secret?: boolean;
}

export interface UpdateEnvVarInput {
  key?: string;
  value?: string;
  is_secret?: boolean;
}

export interface CreateDeployInput {
  service_id: string;
  triggered_by: string;
  commit_sha?: string;
  logs_object_key?: string;
}

export interface CreateUptimeCheckInput {
  service_id: string;
  status_code?: number;
  latency_ms?: number;
  ssl_days_left?: number;
  ok: boolean;
  error?: string;
}

export interface CreateAuditLogInput {
  actor_email: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  meta_json?: Record<string, unknown>;
}

export interface CreatePackageUpdateInput {
  project_id: string;
  ecosystem: PackageEcosystem;
  packages_updated: string[];
  old_versions: Record<string, string>;
  new_versions: Record<string, string>;
  status: PackageUpdateStatus;
  test_output?: string | null;
  error_message?: string | null;
  branch_name?: string | null;
  pr_url?: string | null;
  rollback_data?: string | null;
  rollback_from_id?: string | null; // For rollback operations
  completed_at?: string | null;
}

export interface UpdatePackageUpdateInput {
  status?: PackageUpdateStatus;
  test_output?: string | null;
  error_message?: string | null;
  branch_name?: string | null;
  pr_url?: string | null;
  completed_at?: string | null;
}
