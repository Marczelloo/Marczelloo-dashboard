import "server-only";

import type { AgentStatus } from "@agent/types";
import { isDemoMode } from "@/lib/demo-mode";
import { getAgentStatus, isAgentConfigured } from "@/server/agent/client";
import { projects, services } from "@/server/data";
import { demoOverviewInputs } from "@/server/overview/demo";
import type { Service } from "@/types";

export interface ServiceRow {
  id: string;
  name: string;
  type: Service["type"];
  url: string | null;
  projectId: string | null;
  projectName: string | null;
  composeProject: string | null;
  containerId: string | null;
  /** What the container is doing, when the agent can see one. */
  containerStatus: string | null;
  running: boolean | null;
  restarts: number;
}

export interface ServiceList {
  rows: ServiceRow[];
  projects: Array<{ id: string; name: string }>;
  /** False when the agent is not configured, so the UI can say why state is missing. */
  live: boolean;
}

/** Matches a service to its container the way the project page does: compose project plus service name. */
function containerOf(service: Service, agent: AgentStatus | null) {
  if (!agent || service.type !== "docker") return null;
  const compose = service.compose_project;
  const status = compose ? agent.projects[compose] : undefined;
  const containers = status?.containers ?? Object.values(agent.projects).flatMap((project) => project.containers);
  return containers.find((container) => container.service === service.name || container.name === service.container_id) ?? null;
}

export async function listServices(): Promise<ServiceList> {
  const [allServices, allProjects, agent] = await Promise.all([
    services.getServices({ limit: 1000 }).catch(() => [] as Service[]),
    projects.getProjects({ limit: 1000 }).catch(() => []),
    isDemoMode()
      ? Promise.resolve(demoOverviewInputs(new Date()).agent)
      : isAgentConfigured()
        ? getAgentStatus().catch(() => null)
        : Promise.resolve(null),
  ]);

  const names = new Map(allProjects.map((project) => [project.id, project.name]));

  const rows = allServices.map((service): ServiceRow => {
    const container = containerOf(service, agent);
    return {
      id: service.id,
      name: service.name,
      type: service.type,
      url: service.url,
      projectId: service.project_id,
      projectName: service.project_id ? (names.get(service.project_id) ?? null) : null,
      composeProject: service.compose_project,
      containerId: service.container_id,
      containerStatus: container?.status ?? null,
      running: service.type === "docker" ? (container ? container.status === "running" : null) : true,
      restarts: container?.restartCount ?? 0,
    };
  });

  return {
    rows,
    projects: allProjects.map((project) => ({ id: project.id, name: project.name })),
    live: agent !== null,
  };
}
