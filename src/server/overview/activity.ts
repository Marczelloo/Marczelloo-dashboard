import type { Tone } from "@/lib/tone";
import type { AuditAction, DeployStatus } from "@/types";
import type { ActivityItem, OverviewInputs } from "./types";

const DEPLOY: Record<DeployStatus, { tone: Tone; verb: string }> = {
  pending: { tone: "live", verb: "Deploy queued" },
  running: { tone: "live", verb: "Deploying" },
  success: { tone: "ok", verb: "Deployed" },
  failed: { tone: "err", verb: "Deploy failed" },
  cancelled: { tone: "idle", verb: "Deploy cancelled" },
};

/** Audit actions worth showing next to deploys; deploys themselves come from the deploys table. */
const AUDIT_ACTIONS = new Set<AuditAction>(["restart", "stop", "start", "rollback", "delete", "create", "link", "unlink", "import"]);

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function mergeActivity(input: Pick<OverviewInputs, "deploys" | "services" | "projects" | "audit" | "incidents">, limit = 8): ActivityItem[] {
  const projectName = new Map(input.projects.map((project) => [project.id, project.name]));
  const serviceProject = new Map(input.services.map((service) => [service.id, service.project_id]));
  const items: ActivityItem[] = [];

  for (const deploy of input.deploys) {
    const projectId = serviceProject.get(deploy.service_id) ?? null;
    const { tone, verb } = DEPLOY[deploy.status];
    const sha = deploy.commit_sha?.slice(0, 7) ?? null;
    const detail = [sha, deploy.status === "failed" ? deploy.error_message : null].filter(Boolean).join(" · ") || null;
    items.push({
      id: `deploy:${deploy.id}`,
      at: deploy.started_at,
      tone,
      title: `${verb} · ${(projectId && projectName.get(projectId)) ?? "Unknown project"}`,
      detail,
      href: projectId ? `/projects/${projectId}?tab=deployments` : null,
    });
  }

  for (const incident of input.incidents) {
    const href = incident.project_id ? `/projects/${incident.project_id}` : "/monitoring";
    items.push({
      id: `incident:${incident.id}`,
      at: incident.started_at,
      tone: incident.severity === "down" ? "err" : "warn",
      title: `${incident.label} ${incident.severity === "down" ? "down" : "degraded"}`,
      detail: incident.reason,
      href,
    });
    if (incident.ended_at) items.push({ id: `incident:${incident.id}:end`, at: incident.ended_at, tone: "ok", title: `${incident.label} recovered`, detail: null, href });
  }

  for (const entry of input.audit) {
    if (!AUDIT_ACTIONS.has(entry.action)) continue;
    const name = typeof entry.meta_json?.name === "string" ? entry.meta_json.name : entry.entity_type;
    items.push({ id: `audit:${entry.id}`, at: entry.at, tone: "idle", title: `${capitalize(entry.action)} · ${name}`, detail: null, href: null });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
