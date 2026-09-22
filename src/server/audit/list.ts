import "server-only";

import { categoryOf, detailsOf, toneOf, verbOf, type AuditList, type AuditRow } from "@/lib/audit";
import { auditLogs, projects, services } from "@/server/data";
import type { AuditLog, Project, Service } from "@/types";

/** Entities whose id is a project id. */
const PROJECT_ENTITIES = new Set(["project", "release", "github_repo"]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Recent audit events, each resolved to the thing it happened to. */
export async function listAudit(limit = 500): Promise<AuditList> {
  const [logs, allProjects, allServices] = await Promise.all([
    auditLogs.getRecentAuditLogs(limit),
    projects.getProjects({ limit: 1000 }).catch(() => [] as Project[]),
    services.getServices({ limit: 1000 }).catch(() => [] as Service[]),
  ]);

  const projectById = new Map(allProjects.map((project) => [project.id, project]));
  const serviceById = new Map(allServices.map((service) => [service.id, service]));

  const rows = logs.map((log: AuditLog): AuditRow => {
    const meta = log.meta_json;
    let subject: string | null = null;
    let href: string | null = null;
    let projectId: string | null = null;

    const serviceRef = (id: string | null) => {
      const service = id ? serviceById.get(id) : undefined;
      if (!service) return null;
      const project = service.project_id ? projectById.get(service.project_id) : undefined;
      return { subject: project ? `${project.name} / ${service.name}` : service.name, href: `/services/${service.id}`, projectId: service.project_id ?? null };
    };

    if (log.entity_id && PROJECT_ENTITIES.has(log.entity_type)) {
      const project = projectById.get(log.entity_id);
      projectId = log.entity_id;
      subject = project?.name ?? text(meta?.project) ?? text(meta?.name);
      href = project ? `/projects/${project.id}` : null;
      const tag = text(meta?.tag);
      if (log.entity_type === "release" && tag) subject = `${subject ?? "release"} ${tag}`;
    } else if (log.entity_type === "service") {
      const ref = serviceRef(log.entity_id);
      subject = ref?.subject ?? text(meta?.name);
      href = ref?.href ?? null;
      projectId = ref?.projectId ?? null;
    } else if (log.entity_type === "env_var") {
      const ref = serviceRef(text(meta?.service_id));
      const key = text(meta?.key);
      subject = [ref?.subject, key].filter(Boolean).join(" · ") || null;
      href = ref?.href ?? null;
      projectId = ref?.projectId ?? null;
    } else if (log.entity_type === "work_item") {
      subject = text(meta?.title);
      projectId = text(meta?.project_id);
    } else if (log.entity_type === "container") {
      subject = text(meta?.command) ?? text(meta?.containerName) ?? log.entity_id;
      const endpoint = meta?.endpointId;
      const container = text(meta?.containerId);
      if (endpoint !== undefined && container) href = `/containers/${String(endpoint)}/${container}`;
    } else if (log.entity_type === "deploy") {
      href = "/deployments";
    }

    if (log.action === "deploy" || log.action === "rollback" || log.action === "github_webhook_trigger") {
      if (!href || href.startsWith("/projects/")) href = projectId ? `/projects/${projectId}?tab=deployments` : "/deployments";
    }

    return {
      id: log.id,
      at: log.at,
      actor: log.actor_email,
      action: log.action,
      entityType: log.entity_type,
      category: categoryOf(log.action, log.entity_type),
      tone: toneOf(log.action, meta),
      verb: verbOf(log.action, log.entity_type, meta),
      subject,
      href,
      projectId,
      details: detailsOf(meta),
    };
  });

  const seenProjects = new Set(rows.map((row) => row.projectId).filter((id): id is string => Boolean(id)));
  return {
    rows,
    actors: [...new Set(rows.map((row) => row.actor))].sort(),
    projects: allProjects
      .filter((project) => seenProjects.has(project.id))
      .map((project) => ({ id: project.id, name: project.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
