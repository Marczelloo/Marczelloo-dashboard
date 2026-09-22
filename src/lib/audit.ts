import type { AuditAction, EntityType } from "@/types";

/** Chip tones an event can take; "neutral" is the everyday case. */
export type AuditTone = "neutral" | "ok" | "warn" | "err";

export type AuditCategory = "deploys" | "changes" | "secrets" | "containers" | "access" | "github";

export const AUDIT_CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "deploys", label: "Deploys" },
  { value: "changes", label: "Changes" },
  { value: "secrets", label: "Variables" },
  { value: "containers", label: "Containers" },
  { value: "access", label: "Access" },
  { value: "github", label: "GitHub" },
];

export interface AuditRow {
  id: string;
  at: string;
  actor: string;
  action: AuditAction;
  entityType: EntityType;
  category: AuditCategory;
  tone: AuditTone;
  /** "Deployed", "Revealed a variable": the event as a sentence start. */
  verb: string;
  /** What it happened to, resolved to a name when possible. */
  subject: string | null;
  href: string | null;
  /** Project the event belongs to, for filtering. */
  projectId: string | null;
  details: { key: string; value: string }[];
}

export interface AuditList {
  rows: AuditRow[];
  actors: string[];
  projects: { id: string; name: string }[];
}

const GITHUB_ENTITIES = new Set<EntityType>(["github_repo", "github_repos", "github_issue", "release", "work_item_pr", "work_item_github"]);

export function categoryOf(action: AuditAction, entityType: EntityType): AuditCategory {
  if (action === "deploy" || action === "rollback" || action === "clear_deploys" || action === "github_deploy" || action === "github_webhook_trigger") return "deploys";
  if (entityType === "env_var" || action === "reveal_secret") return "secrets";
  if (entityType === "container" || action === "docker_exec" || action === "docker_exec_blocked") return "containers";
  if (entityType === "auth" || action === "login" || action === "pin_verify") return "access";
  if (GITHUB_ENTITIES.has(entityType) || action === "github_sync" || action === "import" || action === "link" || action === "unlink" || action === "sync") return "github";
  return "changes";
}

const NOUN: Partial<Record<EntityType, string>> = {
  project: "project",
  service: "service",
  work_item: "task",
  env_var: "variable",
  deploy: "deploy history",
  container: "container",
  github_repo: "repository",
  github_repos: "repositories",
  release: "release",
  github_issue: "issue",
  work_item_pr: "pull request",
  work_item_github: "GitHub issue",
  package_update: "package update",
};

export function verbOf(action: AuditAction, entityType: EntityType, meta: Record<string, unknown> | null): string {
  const noun = NOUN[entityType] ?? entityType.replace(/_/g, " ");
  switch (action) {
    case "create":
      return `Created ${noun}`;
    case "update":
      return `Updated ${noun}`;
    case "delete":
      return `Deleted ${noun}`;
    case "deploy":
      return meta?.status === "failed" ? "Deploy failed" : "Deployed";
    case "rollback":
      return "Rolled back";
    case "restart":
      return `Restarted ${noun}`;
    case "stop":
      return `Stopped ${noun}`;
    case "start":
      return `Started ${noun}`;
    case "reveal_secret":
      return "Revealed a variable";
    case "login":
      return "Signed in";
    case "pin_verify":
      return meta?.success === false ? "Entered a wrong PIN" : "Unlocked with PIN";
    case "docker_exec":
      return "Ran in the console";
    case "docker_exec_blocked":
      return "Console refused";
    case "clear_deploys":
      return "Cleared deploy history";
    case "github_sync":
    case "sync":
      return `Synced ${noun}`;
    case "github_webhook_trigger":
      return "Push received";
    case "github_deploy":
      return "Deployed from GitHub";
    case "link":
      return `Linked ${noun}`;
    case "unlink":
      return `Unlinked ${noun}`;
    case "import":
      return `Imported ${noun}`;
    default:
      return String(action).replace(/_/g, " ");
  }
}

export function toneOf(action: AuditAction, meta: Record<string, unknown> | null): AuditTone {
  if (meta?.success === false || meta?.status === "failed") return "err";
  if (action === "delete" || action === "docker_exec_blocked" || action === "stop") return "err";
  if (action === "reveal_secret" || action === "rollback" || action === "restart" || action === "docker_exec" || action === "clear_deploys") return "warn";
  if (action === "create" || action === "deploy" || action === "start" || action === "import" || action === "github_deploy") return "ok";
  return "neutral";
}

/** Keys whose values are never shown, whatever they hold. */
const SECRET_KEY = /(secret|token|password|passwd|value|private|credential|api[_-]?key)/i;
const MAX_VALUE = 160;
/** Ids already shown as the event's subject. */
const RESOLVED = new Set(["service_id", "project_id"]);

function show(value: unknown): string {
  if (Array.isArray(value)) return value.map(show).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Meta as readable rows, with anything secret-looking hidden and long values cut. */
export function detailsOf(meta: Record<string, unknown> | null): { key: string; value: string }[] {
  if (!meta) return [];
  return Object.entries(meta)
    .filter(([key, value]) => !RESOLVED.has(key) && value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const text = SECRET_KEY.test(key) ? "hidden" : show(value);
      return { key: key.replace(/_/g, " "), value: text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text };
    });
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: AuditRow[]): string {
  const header = ["time", "actor", "category", "action", "subject", "details"];
  const lines = rows.map((row) =>
    [row.at, row.actor, row.category, row.verb, row.subject ?? "", row.details.map((detail) => `${detail.key}=${detail.value}`).join("; ")].map(csvCell).join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
