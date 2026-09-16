import type { ProjectStatus } from "@agent/types";
import type { TunnelIngressRule } from "@/server/cloudflare/ingress";
import type { DeploymentConfig } from "@/server/deployments/config";
import type { MonitorTarget } from "./types";

const MUTE_AFTER_JOB_MS = 2 * 60 * 1000;

export interface TargetSources {
  /** Ingress rules of the managed tunnel; null when Cloudflare could not be read. */
  ingress: TunnelIngressRule[] | null;
  previousDomains: Array<{ host: string; projectId: string | null }>;
  configs: Array<Pick<DeploymentConfig, "projectId" | "composeProject" | "engine" | "tunnel">>;
  services: Array<{ project_id: string | null; url: string | null }>;
  routes: Array<{ hostname: string | null; project_id: string | null }>;
}

/** Public hostname of a service URL; local addresses are not probed from the dashboard. */
export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes(".") && !/^[\d.]+$/.test(host) && !host.startsWith("[") && !host.endsWith(".local") ? host : null;
  } catch {
    return null;
  }
}

export function buildTargets(sources: TargetSources): MonitorTarget[] {
  const agentConfigs = sources.configs.filter((config) => config.engine === "agent");
  const composeByProject = new Map(sources.configs.map((config) => [config.projectId, config.composeProject]));

  const owner = new Map<string, string>();
  const claim = (host: string | null, projectId: string | null) => {
    if (host && projectId && !owner.has(host)) owner.set(host, projectId);
  };
  // Most specific first: the deploy config's own route, then service URLs, then imported routes.
  for (const config of sources.configs) claim(config.tunnel?.hostname?.toLowerCase() ?? null, config.projectId);
  for (const service of sources.services) claim(hostOf(service.url), service.project_id);
  for (const route of sources.routes) claim(route.hostname?.toLowerCase() ?? null, route.project_id);
  for (const previous of sources.previousDomains) claim(previous.host, previous.projectId);

  // Service URLs cover sites hosted outside the tunnel (e.g. Vercel) that had uptime history before.
  const hosts = [
    ...(sources.ingress
      ? sources.ingress.map((rule) => rule.hostname?.toLowerCase()).filter((host): host is string => Boolean(host) && !host!.includes("*"))
      : sources.previousDomains.map((previous) => previous.host)),
    ...sources.services.map((service) => hostOf(service.url)).filter((host): host is string => host !== null),
  ];
  const uniqueHosts = [...new Set(hosts)].sort();

  const hostTarget = (kind: "domain" | "tls", host: string): MonitorTarget => {
    const projectId = owner.get(host) ?? null;
    return { key: `${kind}:${host}`, kind, label: host, projectId, composeProject: projectId ? composeByProject.get(projectId) ?? null : null, host };
  };

  return [
    { key: "agent", kind: "agent", label: "Agent wdrożeń", projectId: null, composeProject: null, host: null },
    { key: "disk", kind: "disk", label: "Dysk Pi", projectId: null, composeProject: null, host: null },
    ...agentConfigs.map((config): MonitorTarget => ({ key: `containers:${config.composeProject}`, kind: "containers", label: config.composeProject, projectId: config.projectId, composeProject: config.composeProject, host: null })),
    ...uniqueHosts.map((host) => hostTarget("domain", host)),
    ...uniqueHosts.map((host) => hostTarget("tls", host)),
  ];
}

/** A deploy recreates containers and briefly breaks the domain; its checks are not failures. */
export function isMuted(project: ProjectStatus | undefined, now: number): boolean {
  if (!project) return false;
  if (project.activeJob) return true;
  return project.lastFinishedAt !== null && now - Date.parse(project.lastFinishedAt) < MUTE_AFTER_JOB_MS;
}
