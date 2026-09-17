import "server-only";

import { agentPreflight, getAgentHost, getAgentStatus } from "@/server/agent/client";
import { applyManagedRouteUpdate, getManagedTunnelSettings, listManagedRoutes } from "@/server/cloudflare/managed-tunnel";
import { validateRepoPath } from "@/server/deployments/paths";
import { getRepositoryCloneToken } from "@/server/github/client";
import type { DeploymentConfig } from "./config";
import { bindingForPort, containerService } from "./edge";
import { pickDeploymentPort, portUsedByOthers } from "./ports";

export const PROJECTS_DIR = process.env.PROJECTS_DIR || "/home/Marczelloo_pi/projects";

/**
 * EDGE_NETWORK attaches routed containers to the shared network; TUNNEL_ORIGIN=edge
 * makes new routes target containers by name (set once cloudflared runs on that network).
 */
export function edgeSettings(): { network: string | null; containerOrigins: boolean } {
  const network = process.env.EDGE_NETWORK?.trim() || null;
  return { network, containerOrigins: Boolean(network) && process.env.TUNNEL_ORIGIN === "edge" };
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
    throw new Error("Port wdrożenia musi być liczbą od 1 do 65535.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(composeProject)) {
    throw new Error("Nieprawidłowa nazwa projektu Docker Compose.");
  }
  const [host, own] = await Promise.all([getAgentHost(), projectContainers(composeProject)]);
  return pickDeploymentPort(preferredPort, host.publishedPorts, own);
}

function requireSafeConfig(config: DeploymentConfig) {
  validateRepoPath(config.repoPath);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(config.composeProject)) {
    throw new Error("Nieprawidłowa nazwa projektu Docker Compose.");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(config.branch) || config.branch.startsWith("-") || config.branch.includes("..")) {
    throw new Error("Nieprawidłowa nazwa brancha.");
  }
  if (config.composeFile && (!/^[A-Za-z0-9][A-Za-z0-9_.\/-]*$/.test(config.composeFile) || config.composeFile.includes(".."))) {
    throw new Error("Nieprawidłowa ścieżka pliku Compose.");
  }
  if (config.profiles.some((profile) => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(profile))) {
    throw new Error("Nieprawidłowy profil Docker Compose.");
  }
  if (config.tunnel && (!Number.isInteger(config.tunnel.localPort) || config.tunnel.localPort < 1 || config.tunnel.localPort > 65535)) {
    throw new Error("Port tunelu musi być liczbą od 1 do 65535.");
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
    cloneError = error instanceof Error ? error.message : "GitHub App nie potwierdził dostępu do repozytorium.";
  }

  const tunnel = config.tunnel?.enabled ? config.tunnel : null;
  const [probe, portInUse] = await Promise.all([
    agentPreflight(repoPath, generated ? null : config.composeFile),
    tunnel
      ? Promise.all([getAgentHost(), projectContainers(config.composeProject)]).then(([host, own]) => portUsedByOthers(tunnel.localPort, host.publishedPorts, own))
      : Promise.resolve(false),
  ]);

  if (probe.repoState === "missing") messages.push({ level: "success", text: "Katalog jeszcze nie istnieje — agent utworzy go przez git clone." });
  if (probe.repoState === "directory") messages.push({ level: "error", text: "Docelowy katalog istnieje, ale nie jest repozytorium Git. Wybierz inną ścieżkę." });
  if (probe.repoState === "git") messages.push({ level: "success", text: "Znaleziono istniejące repozytorium Git." });
  if (cloneAccess) messages.push({ level: "success", text: "GitHub App potwierdził dostęp do repozytorium dla tego wdrożenia." });
  else messages.push({ level: "error", text: cloneError || "GitHub App nie ma dostępu do tego repozytorium. Dodaj je do instalacji aplikacji GitHub." });

  if (generated) {
    const build = config.build!;
    const kind = build.kind === "dockerfile" ? `Dockerfile (${build.dockerfile})` : `szablon ${build.framework ?? build.kind}`;
    messages.push({ level: "success", text: `Compose zostanie wygenerowany przez dashboard: ${kind}.` });
  } else if (probe.composeFile && probe.composeValid) {
    messages.push({ level: "success", text: `Compose poprawny: ${probe.composeFile}.` });
  } else if (probe.composeFile) {
    messages.push({ level: "error", text: "Plik Compose nie przechodzi `docker compose config`." });
  } else if (probe.repoState !== "missing") {
    messages.push({ level: "error", text: "Nie znaleziono compose.yaml, compose.yml ani docker-compose.yml." });
  } else {
    messages.push({ level: "warning", text: "Compose zostanie wykryty po pierwszym klonowaniu; można wskazać jego ścieżkę ręcznie." });
  }

  if (tunnel && !getManagedTunnelSettings()) messages.push({ level: "error", text: "Włączono Cloudflare Tunnel, ale dashboard nie ma skonfigurowanego Cloudflare API." });
  if (tunnel && portInUse) messages.push({ level: "warning", text: `Port ${tunnel.localPort} jest zajęty przez inny projekt; przy wdrożeniu zostanie wybrany wolny.` });

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
  if (!getManagedTunnelSettings()) throw new Error("Cloudflare API nie jest skonfigurowane (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_TUNNEL_ID).");
  let service: string | null = null;
  if (update.hostname && update.localPort && edgeSettings().containerOrigins) {
    service = await resolveContainerOrigin(update.localPort);
    if (!service) throw new Error(`Żaden kontener nie publikuje portu ${update.localPort}, więc trasy ${update.hostname} nie da się skierować na kontener.`);
  }
  const { changed, dns } = await applyManagedRouteUpdate({ ...update, service });
  if (dns.length) console.log(`[Cloudflare] ${dns.join(", ")}`);
  return { changed };
}

export async function listCloudflareTunnelRoutes(): Promise<{ configured: boolean; routes: TunnelIngressRoute[]; error?: string }> {
  if (!getManagedTunnelSettings()) return { configured: false, routes: [] };
  try {
    const rules = await listManagedRoutes();
    return { configured: true, routes: rules.flatMap((rule) => (rule.hostname ? [{ hostname: rule.hostname, service: rule.service }] : [])) };
  } catch (error) {
    return { configured: true, routes: [], error: error instanceof Error ? error.message : "Nie udało się odczytać tunelu z Cloudflare API." };
  }
}
