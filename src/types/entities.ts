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
  | "pin_verify";

export type EntityType = "project" | "service" | "work_item" | "env_var" | "deploy" | "container" | "auth";

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
