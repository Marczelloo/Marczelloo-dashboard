import "server-only";

import type { AgentStatus } from "@agent/types";
import { isDemoMode } from "@/lib/demo-mode";
import type { DeployList, DeployRow } from "@/lib/deploys";
import { getAgentStatus, isAgentConfigured } from "@/server/agent/client";
import { deploys, projects, services } from "@/server/data";
import { demoOverviewInputs } from "@/server/overview/demo";
import type { Deploy, Project, Service } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function stepOf(deploy: Deploy, service: Service | undefined, agent: AgentStatus | null): string | null {
  if (!agent || (deploy.status !== "running" && deploy.status !== "pending")) return null;
  const compose = service?.compose_project;
  const job = compose ? agent.projects[compose]?.activeJob : null;
  return job?.step ?? null;
}

/** Every deploy the dashboard has recorded, newest first, told in project terms. */
export async function listDeploys(limit = 100): Promise<DeployList> {
  const now = new Date();
  const [recent, allServices, allProjects, agent] = await Promise.all([
    deploys.getRecentDeploys(limit).catch(() => [] as Deploy[]),
    services.getServices({ limit: 1000 }).catch(() => [] as Service[]),
    projects.getProjects({ limit: 1000 }).catch(() => [] as Project[]),
    isDemoMode()
      ? Promise.resolve(demoOverviewInputs(now).agent)
      : isAgentConfigured()
        ? getAgentStatus().catch(() => null)
        : Promise.resolve(null),
  ]);

  const serviceById = new Map(allServices.map((service) => [service.id, service]));
  const projectById = new Map(allProjects.map((project) => [project.id, project]));

  const rows = recent
    .map((deploy): DeployRow => {
      const service = serviceById.get(deploy.service_id);
      const project = service?.project_id ? projectById.get(service.project_id) : undefined;
      const finished = deploy.finished_at ? Date.parse(deploy.finished_at) : null;
      return {
        id: deploy.id,
        status: deploy.status,
        serviceId: deploy.service_id,
        serviceName: service?.name ?? null,
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        commitSha: deploy.commit_sha,
        triggeredBy: deploy.triggered_by,
        startedAt: deploy.started_at,
        finishedAt: deploy.finished_at,
        durationMs: finished ? finished - Date.parse(deploy.started_at) : null,
        error: deploy.error_message,
        logsKey: deploy.logs_object_key,
        step: stepOf(deploy, service, agent),
      };
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const since = now.getTime() - 7 * DAY_MS;
  const week = rows.filter((row) => Date.parse(row.startedAt) >= since);

  return {
    generatedAt: now.toISOString(),
    rows,
    projects: allProjects.map((project) => ({ id: project.id, name: project.name })),
    running: rows.filter((row) => row.status === "running" || row.status === "pending").length,
    last7d: { total: week.length, failed: week.filter((row) => row.status === "failed").length },
  };
}
