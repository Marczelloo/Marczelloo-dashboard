import path from "node:path";
import type { DeployTarget } from "./types";

export interface ComposeConfigJson {
  services?: Record<string, { image?: string; build?: unknown; networks?: Record<string, unknown> | null; ports?: Array<{ published?: string | number; target?: number; protocol?: string; host_ip?: string }> }>;
}

const COMPOSE_CANDIDATES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];

export function resolveComposeFile(target: DeployTarget, exists: (filePath: string) => boolean): string {
  if (target.composeFile) {
    const configured = `${target.repoPath}/${target.composeFile}`;
    if (!exists(configured)) throw new Error(`Brak pliku Compose ${target.composeFile} w repozytorium.`);
    return configured;
  }
  const found = COMPOSE_CANDIDATES.map((name) => `${target.repoPath}/${name}`).find(exists);
  if (!found) throw new Error("Nie znaleziono pliku Compose w repozytorium.");
  return found;
}

export function composeArgs(target: DeployTarget, files: string[]): string[] {
  // Same default as Compose and the legacy script: the directory of the first file.
  // A generated file lives in the agent's data directory, so relative paths resolve against the repository.
  return [
    "compose",
    "-p",
    target.composeProject,
    "--project-directory",
    target.generatedCompose ? target.repoPath : path.posix.dirname(files[0]),
    ...files.flatMap((file) => ["-f", file]),
    ...target.profiles.flatMap((profile) => ["--profile", profile]),
  ];
}

export function imageRepository(project: string, service: string, image?: string): string {
  if (!image) return `${project}-${service}`;
  const withoutDigest = image.split("@")[0];
  const lastSlash = withoutDigest.lastIndexOf("/");
  const lastColon = withoutDigest.lastIndexOf(":");
  // A colon after the last slash is a tag; before it, a registry port.
  return lastColon > lastSlash ? withoutDigest.slice(0, lastColon) : withoutDigest;
}

function tunnelPortCandidate(config: ComposeConfigJson, port: number): { service: string; published: string; target: number; hostIp: string } | null {
  const candidates = Object.entries(config.services ?? {}).flatMap(([service, definition]) =>
    (definition.ports ?? [])
      .filter((entry) => entry.published !== undefined && entry.target !== undefined && (entry.protocol ?? "tcp") === "tcp")
      .map((entry) => ({ service, published: String(entry.published), target: Number(entry.target), hostIp: entry.host_ip ?? "" }))
  );
  const matching = candidates.filter((candidate) => candidate.published === String(port));
  if (candidates.length === 1) return candidates[0];
  if (matching.length === 1) return matching[0];
  // Without host ports the configured port is the container port.
  const byTarget = Object.entries(config.services ?? {}).flatMap(([service, definition]) =>
    (definition.ports ?? [])
      .filter((entry) => entry.target === port && (entry.protocol ?? "tcp") === "tcp")
      .map((entry) => ({ service, published: String(entry.published ?? ""), target: port, hostIp: entry.host_ip ?? "" }))
  );
  return byTarget.length === 1 ? byTarget[0] : null;
}

export function loopbackPortOverride(config: ComposeConfigJson, port: number): { service: string; mapping: string } | null {
  const chosen = tunnelPortCandidate(config, port);
  if (!chosen) throw new Error("Automatyczny port wymaga jednego opublikowanego portu TCP (albo jednego już mapowanego na wybrany port).");
  if (chosen.published === String(port) && chosen.hostIp === "127.0.0.1") return null;
  return { service: chosen.service, mapping: `127.0.0.1:${port}:${chosen.target}/tcp` };
}

export interface EdgeAttachment {
  network: string;
  /** Edge services publish no host ports; the tunnel reaches them over the network. */
  dropPorts: boolean;
  /** Service → networks it already uses, kept because a service's network list is replaced as a whole. */
  services: Record<string, string[]>;
}

/**
 * Edge services that exist in this project, with their current networks. The
 * service publishing the tunnel port always joins, so a new project needs no
 * extra configuration.
 */
export function edgeAttachment(
  config: ComposeConfigJson,
  edge: { network: string; services: string[]; dropPorts?: boolean } | null | undefined,
  tunnelPort: number | null = null,
  explicitTunnelService: string | null = null
): EdgeAttachment | null {
  if (!edge) return null;
  const tunnelService = explicitTunnelService ?? (tunnelPort ? tunnelPortCandidate(config, tunnelPort)?.service : undefined);
  const services: Record<string, string[]> = {};
  for (const name of new Set([...edge.services, ...(tunnelService ? [tunnelService] : [])])) {
    const definition = config.services?.[name];
    if (!definition) throw new Error(`Usługa ${name} nie istnieje w projekcie Compose (sieć ${edge.network}).`);
    services[name] = Object.keys(definition.networks ?? { default: null }).filter((network) => network !== edge.network);
  }
  return Object.keys(services).length ? { network: edge.network, dropPorts: Boolean(edge.dropPorts), services } : null;
}

export function renderOverride(images: Record<string, string>, port: { service: string; mapping: string } | null, edge: EdgeAttachment | null = null): string {
  const names = [...new Set([...Object.keys(images), ...(port ? [port.service] : []), ...Object.keys(edge?.services ?? {})])].sort();
  if (!names.length) return "services: {}\n";
  const lines = ["services:"];
  for (const name of names) {
    lines.push(`  ${JSON.stringify(name)}:`);
    if (images[name]) lines.push(`    image: ${JSON.stringify(images[name])}`);
    if (port?.service === name) lines.push("    ports: !override", `      - ${JSON.stringify(port.mapping)}`);
    else if (edge?.dropPorts && edge.services[name]) lines.push("    ports: !reset []");
    const networks = edge?.services[name];
    if (networks) {
      lines.push("    networks:");
      for (const network of [...networks, edge!.network]) lines.push(`      ${JSON.stringify(network)}: {}`);
    }
  }
  if (edge) lines.push("networks:", `  ${JSON.stringify(edge.network)}:`, "    external: true", `    name: ${JSON.stringify(edge.network)}`);
  return `${lines.join("\n")}\n`;
}

export function buildOverride(
  config: ComposeConfigJson,
  input: { project: string; sha: string; tunnelPort: number | null; tunnelService?: string | null; edge?: { network: string; services: string[]; dropPorts?: boolean } | null }
): { yaml: string; images: Record<string, string> } {
  const tag = input.sha.slice(0, 12);
  const images: Record<string, string> = {};
  for (const [service, definition] of Object.entries(config.services ?? {})) {
    if (definition.build) images[service] = `${imageRepository(input.project, service, definition.image)}:${tag}`;
  }
  const port = input.tunnelPort && !input.edge?.dropPorts ? loopbackPortOverride(config, input.tunnelPort) : null;
  return { yaml: renderOverride(images, port, edgeAttachment(config, input.edge, input.tunnelPort, input.tunnelService ?? null)), images };
}
