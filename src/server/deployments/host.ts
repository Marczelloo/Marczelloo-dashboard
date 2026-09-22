import "server-only";

import { agentPreflight, getAgentHost, getAgentStatus } from "@/server/agent/client";
import { applyManagedRouteUpdate, getManagedTunnelSettings, listManagedRoutes } from "@/server/cloudflare/managed-tunnel";
import { validateRepoPath } from "@/server/deployments/paths";
import { getRepositoryCloneToken } from "@/server/github/client";
import { saveDeploymentConfig, type DeploymentConfig } from "./config";
import { bindingForPort, containerService, pickTunnelPort } from "./edge";
import { pickDeploymentPort, portUsedByOthers } from "./ports";

export const PROJECTS_DIR = process.env.PROJECTS_DIR || "/home/Marczelloo_pi/projects";

/**
 * EDGE_NETWORK attaches routed containers to the shared network; TUNNEL_ORIGIN=edge
 * makes new routes target containers by name (set once cloudflared runs on that network).
 */
export function edgeSettings(): { network: string | null; containerOrigins: boolean; dropPorts: boolean } {
  const network = process.env.EDGE_NETWORK?.trim() || null;
  const containerOrigins = Boolean(network) && process.env.TUNNEL_ORIGIN === "edge";
  // EDGE_DROP_PORTS=true: routed services stop publishing host ports at all.
  return { network, containerOrigins, dropPorts: containerOrigins && process.env.EDGE_DROP_PORTS === "true" };
}

/**
 * Remember which service and container port the project's route reaches, so
 * the origin can be found without a published host port. Read from the
 * repository's compose file (the dashboard-rendered one names its service "app").
 */
export async function ensureTunnelTarget(config: DeploymentConfig): Promise<DeploymentConfig> {
  const tunnel = config.tunnel;
  if (!tunnel?.enabled || (tunnel.service && tunnel.port) || !edgeSettings().containerOrigins) return config;
  let target: { service: string; port: number } | null = null;
  if (config.build && config.build.kind !== "compose") {
    target = config.build.port ? { service: "app", port: config.build.port } : null;
  } else {
    const probe = await agentPreflight(config.repoPath, config.composeFile);
    target = pickTunnelPort(probe.ports, tunnel.localPort);
  }
  if (!target) return config;
  return saveDeploymentConfig({ ...config, tunnel: { ...tunnel, service: target.service, port: target.port } });
}

/** Container origin of the project's route: by remembered service, else by published loopback port. */
export async function resolveTunnelOrigin(config: DeploymentConfig): Promise<string | null> {
  const tunnel = config.tunnel;
  if (!tunnel?.enabled) return null;
  if (tunnel.service && tunnel.port) {
    const containers = (await getAgentStatus()).projects[config.composeProject]?.containers ?? [];
    const matching = containers.filter((container) => container.service === tunnel.service);
    const container = matching.find((candidate) => candidate.status === "running") ?? matching[0];
    return container ? containerService(container.name, tunnel.port) : null;
  }
  return resolveContainerOrigin(tunnel.localPort);
}

/** Container origin behind a published loopback port, e.g. 3202 → http://marczelloo-tools:3000. */
export async function resolveContainerOrigin(localPort: number): Promise<string | null> {
  const binding = bindingForPort((await getAgentHost()).publishedPorts, localPort);
  return binding ? containerService(binding.container, binding.containerPort) : null;
}

export interface DeploymentPreflight {
  ok: boolean;
  repoState: "missing" | "git" | "directory" | "invalid";
  composeFile: string | null;
  services: string[];
  profiles: string[];
  portInUse: boolean;
  messages: Array<{ level: "success" | "warning" | "error"; text: string }>;
}

export interface TunnelIngressRoute {
  hostname: string;
  service: string;
}

export interface CloudflareRouteUpdate {
  hostname: string | null;
  localPort: number | null;
  removeHostnames?: string[];
  /** The project the route belongs to; with container origins its service is looked up. */
  config?: DeploymentConfig;
}

async function projectContainers(composeProject: string): Promise<string[]> {
  const status = await getAgentStatus();
  return (status.projects[composeProject]?.containers ?? []).map((container) => container.name);
}

/**
 * Reserve a predictable host port for a Compose project. Ports come from the
 * agent's view of published container ports; a port already published by the
 * same project is reusable during a redeploy.
 */
export async function allocateDeploymentPort(preferredPort: number, composeProject: string): Promise<number> {
  if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
    throw new Error("The deploy port must be a number from 1 to 65535.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(composeProject)) {
    throw new Error("Invalid Compose project name.");
  }
  const [host, own] = await Promise.all([getAgentHost(), projectContainers(composeProject)]);
  return pickDeploymentPort(preferredPort, host.publishedPorts, own);
}

function requireSafeConfig(config: DeploymentConfig) {
  validateRepoPath(config.repoPath);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(config.composeProject)) {
    throw new Error("Invalid Compose project name.");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(config.branch) || config.branch.startsWith("-") || config.branch.includes("..")) {
    throw new Error("Invalid branch name.");
  }
  if (config.composeFile && (!/^[A-Za-z0-9][A-Za-z0-9_.\/-]*$/.test(config.composeFile) || config.composeFile.includes(".."))) {
    throw new Error("Invalid Compose file path.");
  }
  if (config.profiles.some((profile) => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(profile))) {
    throw new Error("Invalid Compose profile.");
  }
  if (config.tunnel && (!Number.isInteger(config.tunnel.localPort) || config.tunnel.localPort < 1 || config.tunnel.localPort > 65535)) {
    throw new Error("The tunnel port must be a number from 1 to 65535.");
  }
}

export async function preflightDeployment(config: DeploymentConfig): Promise<DeploymentPreflight> {
  requireSafeConfig(config);
  const messages: DeploymentPreflight["messages"] = [];
  const repoPath = validateRepoPath(config.repoPath);
  const generated = Boolean(config.build && config.build.kind !== "compose");

  let cloneAccess = false;
  let cloneError: string | null = null;
  try {
    cloneAccess = Boolean(await getRepositoryCloneToken(config.githubUrl));
  } catch (error) {
    cloneError = error instanceof Error ? error.message : "The GitHub App did not confirm access to the repository.";
  }

  const tunnel = config.tunnel?.enabled ? config.tunnel : null;
  const [probe, portInUse] = await Promise.all([
    agentPreflight(repoPath, generated ? null : config.composeFile),
    tunnel && !edgeSettings().dropPorts
      ? Promise.all([getAgentHost(), projectContainers(config.composeProject)]).then(([host, own]) => portUsedByOthers(tunnel.localPort, host.publishedPorts, own))
      : Promise.resolve(false),
  ]);

  if (probe.repoState === "missing") messages.push({ level: "success", text: "The directory does not exist yet; the agent will create it with git clone." });
  if (probe.repoState === "directory") messages.push({ level: "error", text: "The target directory exists but is not a Git repository. Choose another path." });
  if (probe.repoState === "git") messages.push({ level: "success", text: "Found an existing Git repository." });
  if (cloneAccess) messages.push({ level: "success", text: "The GitHub App can reach this repository." });
  else messages.push({ level: "error", text: cloneError || "The GitHub App cannot reach this repository. Add it to the App's installation." });

  if (generated) {
    const build = config.build!;
    const kind = build.kind === "dockerfile" ? `Dockerfile (${build.dockerfile})` : `szablon ${build.framework ?? build.kind}`;
    messages.push({ level: "success", text: `The dashboard will generate the Compose file: ${kind}.` });
  } else if (probe.composeFile && probe.composeValid) {
    messages.push({ level: "success", text: `Compose poprawny: ${probe.composeFile}.` });
  } else if (probe.composeFile) {
    messages.push({ level: "error", text: "The Compose file does not pass `docker compose config`." });
  } else if (probe.repoState !== "missing") {
    messages.push({ level: "error", text: "No compose.yaml, compose.yml or docker-compose.yml found." });
  } else {
    messages.push({ level: "warning", text: "The Compose file will be found after the first clone; you can also give its path." });
  }

  if (tunnel && !getManagedTunnelSettings()) messages.push({ level: "error", text: "A domain is set, but the dashboard has no Cloudflare API configured." });
  if (tunnel && portInUse) messages.push({ level: "warning", text: `Port ${tunnel.localPort} is used by another project; a free one will be picked on deploy.` });

  return {
    ok: !messages.some((message) => message.level === "error"),
    repoState: probe.repoState,
    composeFile: generated ? null : probe.composeFile,
    services: probe.services,
    profiles: probe.profiles,
    portInUse,
    messages,
  };
}

export async function updateCloudflareTunnelRoute(update: CloudflareRouteUpdate): Promise<{ changed: boolean }> {
  if (!getManagedTunnelSettings()) throw new Error("The Cloudflare API is not configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_TUNNEL_ID).");
  let service: string | null = null;
  if (update.hostname && update.localPort && edgeSettings().containerOrigins) {
    service = update.config ? await resolveTunnelOrigin(update.config) : await resolveContainerOrigin(update.localPort);
    if (!service) throw new Error(`No container publishes port ${update.localPort}, so ${update.hostname} cannot be routed to one.`);
  }
  const { changed, dns } = await applyManagedRouteUpdate({ hostname: update.hostname, localPort: update.localPort, removeHostnames: update.removeHostnames, service });
  if (dns.length) console.log(`[Cloudflare] ${dns.join(", ")}`);
  return { changed };
}

export async function listCloudflareTunnelRoutes(): Promise<{ configured: boolean; routes: TunnelIngressRoute[]; error?: string }> {
  if (!getManagedTunnelSettings()) return { configured: false, routes: [] };
  try {
    const rules = await listManagedRoutes();
    return { configured: true, routes: rules.flatMap((rule) => (rule.hostname ? [{ hostname: rule.hostname, service: rule.service }] : [])) };
  } catch (error) {
    return { configured: true, routes: [], error: error instanceof Error ? error.message : "Could not read the tunnel from the Cloudflare API." };
  }
}
