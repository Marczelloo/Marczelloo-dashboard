import "server-only";

import type { ProjectStatus } from "@agent/types";
import { getAgentStatus, isAgentConfigured } from "@/server/agent/client";
import * as monitor from "@/server/atlashub/monitor";
import type { MonitorIncident } from "@/server/atlashub/monitor";
import { deploys, projects, services, workItems } from "@/server/data";
import { getDeploymentConfig, type DeploymentConfig } from "@/server/deployments/config";
import { isDemoMode } from "@/lib/demo-mode";
import type { TargetState } from "@/server/monitoring/types";
import { attentionFor, toneFor } from "@/server/overview/fleet";
import { hourlyUptime } from "@/server/overview/uptime";
import type { Attention, HourBucket } from "@/server/overview/types";
import type { Tone } from "@/lib/tone";
import type { Deploy, Project, Service, WorkItem } from "@/types";
import { demoOverviewInputs } from "@/server/overview/demo";

export interface ProjectDetail {
  project: Project;
  services: Service[];
  /** The docker service env, domains and restarts act on. */
  primaryService: Service | null;
  workItems: WorkItem[];
  deploys: Deploy[];
  config: DeploymentConfig | null;
  agent: ProjectStatus | null;
  domain: string | null;
  tone: Tone;
  attention: Attention | null;
  uptime: HourBucket[];
  deploys7d: { total: number; failed: number };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const soft = <T>(fallback: T) => (error: unknown): T => {
  console.error("[project detail]", error);
  return fallback;
};

function assemble(
  project: Project,
  projectServices: Service[],
  items: WorkItem[],
  projectDeploys: Deploy[],
  config: DeploymentConfig | null,
  agent: ProjectStatus | null,
  states: TargetState[],
  incidents: MonitorIncident[],
  now: Date
): ProjectDetail {
  const attention = attentionFor({ agent, states });
  const weekAgo = now.getTime() - WEEK_MS;
  const recent = projectDeploys.filter((deploy) => Date.parse(deploy.started_at) >= weekAgo);
  const primaryService =
    projectServices.find((service) => service.type === "docker" && service.compose_project) ?? projectServices.find((service) => service.type === "docker") ?? null;
  return {
    project,
    services: projectServices,
    primaryService,
    workItems: items,
    deploys: projectDeploys,
    config,
    agent,
    domain: config?.tunnel?.hostname ?? (project.prod_url ? new URL(project.prod_url).hostname : null),
    tone: toneFor(attention, states.length > 0),
    attention,
    uptime: hourlyUptime(incidents, project.id, states.length > 0, now),
    deploys7d: { total: recent.length, failed: recent.filter((deploy) => deploy.status === "failed").length },
  };
}

/** Everything the project page renders above its tabs; each source fails softly. */
export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const now = new Date();
  const project = await projects.getProjectById(id);
  if (!project) return null;

  if (isDemoMode()) {
    const demo = demoOverviewInputs(now);
    const demoServices = demo.services.filter((service) => service.project_id === id);
    const composeProject = demoServices.find((service) => service.compose_project)?.compose_project ?? project.slug;
    return assemble(
      project,
      demoServices,
      demo.workItems.filter((item) => item.project_id === id),
      demo.deploys.filter((deploy) => demoServices.some((service) => service.id === deploy.service_id)),
      null,
      demo.agent?.projects[composeProject] ?? null,
      demo.states.filter((state) => state.projectId === id),
      demo.incidents,
      now
    );
  }

  const [projectServices, items, config] = await Promise.all([
    services.getServicesByProjectId(id).catch(soft<Service[]>([])),
    workItems.getWorkItemsByProjectId(id).catch(soft<WorkItem[]>([])),
    getDeploymentConfig(id).catch(soft<DeploymentConfig | null>(null)),
  ]);

  const [deployLists, states, incidents, agentStatus] = await Promise.all([
    Promise.all(projectServices.slice(0, 5).map((service) => deploys.getDeploysByServiceId(service.id, 10).catch(soft<Deploy[]>([])))),
    monitor.listStates().catch(soft<TargetState[]>([])),
    monitor.listRecentIncidents(100).catch(soft<MonitorIncident[]>([])),
    isAgentConfigured() ? getAgentStatus().catch(soft<null>(null)) : Promise.resolve(null),
  ]);

  const projectDeploys = deployLists.flat().sort((a, b) => b.started_at.localeCompare(a.started_at));
  const composeProject = config?.composeProject ?? projectServices.find((service) => service.compose_project)?.compose_project ?? null;

  return assemble(
    project,
    projectServices,
    items,
    projectDeploys,
    config,
    composeProject ? agentStatus?.projects[composeProject] ?? null : null,
    states.filter((state) => state.projectId === id),
    incidents,
    now
  );
}
