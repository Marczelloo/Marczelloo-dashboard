import "server-only";

import { getAgentHost, getAgentStatus, isAgentConfigured } from "@/server/agent/client";
import * as monitor from "@/server/atlashub/monitor";
import { auditLogs, deploys, generalTodos, projects, services, workItems } from "@/server/data";
import { listDeploymentConfigs } from "@/server/deployments/config";
import { toPiMetrics } from "@/server/pi/metrics";
import type { OverviewInputs } from "./types";

/** Nine AtlasHub reads; cached for 30 s by the caller. */
export async function loadDatabaseInputs(): Promise<Omit<OverviewInputs, "agent" | "host">> {
  const [allProjects, allServices, configs, states, incidents, recentDeploys, audit, todos, items] = await Promise.all([
    projects.getProjects({ limit: 1000 }),
    services.getServices({ limit: 1000 }),
    listDeploymentConfigs(),
    monitor.listStates(),
    monitor.listRecentIncidents(100),
    deploys.getRecentDeploys(100),
    auditLogs.getRecentAuditLogs(30),
    generalTodos.getActiveTodos(),
    workItems.getOpenWorkItems(),
  ]);
  return {
    projects: allProjects,
    services: allServices,
    configs: configs.map(({ projectId, composeProject, tunnel }) => ({ projectId, composeProject, tunnel })),
    states,
    incidents,
    deploys: recentDeploys,
    audit,
    todos,
    workItems: items,
  };
}

/** Agent reads do not touch AtlasHub; a failing agent leaves the rest of the overview intact. */
export async function loadLiveInputs(): Promise<Pick<OverviewInputs, "agent" | "host">> {
  if (!isAgentConfigured()) return { agent: null, host: null };
  const [agent, host] = await Promise.all([getAgentStatus().catch(() => null), getAgentHost().then(toPiMetrics).catch(() => null)]);
  return { agent, host };
}
