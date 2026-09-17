import "server-only";

import type { ProjectStatus } from "@agent/types";
import { mockAuditLogs, mockDeploys, mockGeneralTodos, mockPiMetrics, mockProjects, mockServices, mockWorkItems } from "@/lib/mock-data";
import type { MonitorIncident } from "@/server/atlashub/monitor";
import type { TargetState } from "@/server/monitoring/types";
import type { OverviewInputs } from "./types";

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

/**
 * Simulated live state for the public demo: the project with a running mock
 * deploy is mid-build, and the next docker project has a stopped container.
 */
export function demoOverviewInputs(now: Date): OverviewInputs {
  const docker = mockServices.filter((service) => service.type === "docker" && service.project_id);
  const composeOf = (projectId: string) => docker.find((service) => service.project_id === projectId)?.compose_project ?? mockProjects.find((project) => project.id === projectId)?.slug ?? projectId;

  const runningDeploy = mockDeploys.find((deploy) => deploy.status === "running");
  const deployingProject = runningDeploy ? mockServices.find((service) => service.id === runningDeploy.service_id)?.project_id ?? null : null;
  const degradedProject = docker.map((service) => service.project_id!).find((projectId) => projectId !== deployingProject) ?? null;

  const agentProjects: Record<string, ProjectStatus> = {};
  for (const service of docker) {
    const projectId = service.project_id!;
    const running = { name: `${composeOf(projectId)}-${service.name}-1`, service: service.name, status: "running", exitCode: 0, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null };
    const containers = projectId === degradedProject ? [running, { ...running, name: `${composeOf(projectId)}-api-1`, service: "api", status: "exited", exitCode: 137 }] : [running];
    agentProjects[composeOf(projectId)] = {
      containers,
      activeJob: projectId === deployingProject && runningDeploy ? { id: "demo-job", kind: "deploy", status: "running", step: "Build", sha: runningDeploy.commit_sha ?? "0000000", startedAt: runningDeploy.started_at } : null,
      lastFinishedAt: null,
    };
  }

  const states: TargetState[] = mockProjects
    .filter((project) => project.prod_url)
    .map((project) => ({
      key: `domain:${new URL(project.prod_url!).hostname}`,
      kind: "domain",
      label: new URL(project.prod_url!).hostname,
      projectId: project.id,
      status: "ok",
      failCount: 0,
      since: minutesAgo(now, 3 * 24 * 60),
      lastCheckedAt: minutesAgo(now, 0.2),
      lastError: null,
      detail: {},
    }));
  if (degradedProject) {
    states.push({ key: `containers:${composeOf(degradedProject)}`, kind: "containers", label: composeOf(degradedProject), projectId: degradedProject, status: "warning", failCount: 1, since: minutesAgo(now, 14), lastCheckedAt: minutesAgo(now, 0.5), lastError: "api exited (137)", detail: {} });
  }

  const incidents: MonitorIncident[] = degradedProject
    ? [{ id: "demo-incident", target_key: `containers:${composeOf(degradedProject)}`, kind: "containers", label: composeOf(degradedProject), project_id: degradedProject, severity: "warning", reason: "api exited (137)", open: true, started_at: minutesAgo(now, 14), ended_at: null }]
    : [];

  return {
    projects: mockProjects,
    services: mockServices,
    configs: [],
    states,
    incidents,
    deploys: mockDeploys,
    audit: mockAuditLogs,
    todos: mockGeneralTodos,
    workItems: mockWorkItems,
    agent: { generatedAt: now.toISOString(), projects: agentProjects, disk: null, buildCacheBytes: null },
    host: mockPiMetrics,
  };
}
