import { hostOf } from "@/server/monitoring/targets";
import { mergeActivity } from "./activity";
import { attentionFor, rankFleet, toneFor } from "./fleet";
import { tasksDue, toTasks } from "./tasks";
import type { FleetRow, Overview, OverviewInputs } from "./types";
import { hourlyUptime } from "./uptime";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Tags and technologies come back as an array or as a JSON string. */
function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function assembleOverview(inputs: OverviewInputs, now: Date): Overview {
  const configByProject = new Map(inputs.configs.map((config) => [config.projectId, config]));

  const domains = inputs.states.filter((state) => state.kind === "domain");
  const checkedAt = domains.reduce<string | null>((latest, state) => (state.lastCheckedAt && (!latest || state.lastCheckedAt > latest) ? state.lastCheckedAt : latest), null);

  const open = inputs.incidents.filter((incident) => incident.open).sort((a, b) => b.started_at.localeCompare(a.started_at));

  const weekAgo = now.getTime() - WEEK_MS;
  const recent = inputs.deploys.filter((deploy) => Date.parse(deploy.started_at) >= weekAgo);

  const fleet: FleetRow[] = inputs.projects
    .filter((project) => project.status !== "archived")
    .map((project) => {
      const config = configByProject.get(project.id);
      const services = inputs.services.filter((service) => service.project_id === project.id);
      const docker = services.find((service) => service.type === "docker" && service.compose_project) ?? services.find((service) => service.type === "docker") ?? null;
      const composeProject = config?.composeProject ?? docker?.compose_project ?? null;
      const agent = composeProject ? inputs.agent?.projects[composeProject] ?? null : null;
      const states = inputs.states.filter((state) => state.projectId === project.id);
      const monitored = states.length > 0;
      const attention = attentionFor({ agent, states });
      const serviceIds = new Set(services.map((service) => service.id));
      const projectDeploys = inputs.deploys.filter((deploy) => serviceIds.has(deploy.service_id)).sort((a, b) => b.started_at.localeCompare(a.started_at));
      const last = projectDeploys[0];
      return {
        projectId: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description ?? null,
        tags: parseTags(project.tags),
        services: services.length,
        openTasks: inputs.workItems.filter((item) => item.project_id === project.id && item.status !== "done").length,
        deploys7d: projectDeploys.filter((deploy) => Date.parse(deploy.started_at) >= weekAgo).length,
        domain: config?.tunnel?.hostname ?? hostOf(project.prod_url),
        composeProject,
        serviceId: docker?.id ?? null,
        tone: toneFor(attention, monitored),
        uptime: hourlyUptime(inputs.incidents, project.id, monitored, now),
        containers: agent ? { running: agent.containers.filter((container) => container.status === "running").length, total: agent.containers.length } : null,
        lastDeploy: last ? { at: last.started_at, sha: last.commit_sha, status: last.status } : null,
        attention,
      };
    });

  return {
    generatedAt: now.toISOString(),
    domains: { up: domains.filter((state) => state.status === "ok" || state.status === "warning").length, total: domains.length, checkedAt },
    incidents: { open: open.length, newest: open[0] ? { label: open[0].label, since: open[0].started_at } : null },
    deploys7d: { total: recent.length, failed: recent.filter((deploy) => deploy.status === "failed").length },
    host: inputs.host
      ? { hostname: inputs.host.hostname, cpu: inputs.host.cpu.usage, memory: inputs.host.memory.usagePercent, disk: inputs.host.disk.usagePercent, temperature: inputs.host.temperature }
      : null,
    fleet: rankFleet(fleet),
    activity: mergeActivity(inputs),
    tasksDue: tasksDue(toTasks(inputs.todos, inputs.workItems), now),
  };
}
