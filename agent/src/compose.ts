import path from "node:path";
import type { DeployTarget } from "./types";

export interface ComposeConfigJson {
  services?: Record<string, { image?: string; build?: unknown; ports?: Array<{ published?: string | number; target?: number; protocol?: string; host_ip?: string }> }>;
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
  return [
    "compose",
    "-p",
    target.composeProject,
    "--project-directory",
    path.posix.dirname(files[0]),
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

export function loopbackPortOverride(config: ComposeConfigJson, port: number): { service: string; mapping: string } | null {
  const candidates = Object.entries(config.services ?? {}).flatMap(([service, definition]) =>
    (definition.ports ?? [])
      .filter((entry) => entry.published !== undefined && entry.target !== undefined && (entry.protocol ?? "tcp") === "tcp")
      .map((entry) => ({ service, published: String(entry.published), target: Number(entry.target), hostIp: entry.host_ip ?? "" }))
  );
  const matching = candidates.filter((candidate) => candidate.published === String(port));
  const chosen = candidates.length === 1 ? candidates[0] : matching.length === 1 ? matching[0] : null;
  if (!chosen) throw new Error("Automatyczny port wymaga jednego opublikowanego portu TCP (albo jednego już mapowanego na wybrany port).");
  if (chosen.published === String(port) && chosen.hostIp === "127.0.0.1") return null;
  return { service: chosen.service, mapping: `127.0.0.1:${port}:${chosen.target}/tcp` };
}

export function renderOverride(images: Record<string, string>, port: { service: string; mapping: string } | null): string {
  const names = [...new Set([...Object.keys(images), ...(port ? [port.service] : [])])].sort();
  if (!names.length) return "services: {}\n";
  const lines = ["services:"];
  for (const name of names) {
    lines.push(`  ${JSON.stringify(name)}:`);
    if (images[name]) lines.push(`    image: ${JSON.stringify(images[name])}`);
    if (port?.service === name) lines.push("    ports: !override", `      - ${JSON.stringify(port.mapping)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildOverride(config: ComposeConfigJson, input: { project: string; sha: string; tunnelPort: number | null }): { yaml: string; images: Record<string, string> } {
  const tag = input.sha.slice(0, 12);
  const images: Record<string, string> = {};
  for (const [service, definition] of Object.entries(config.services ?? {})) {
    if (definition.build) images[service] = `${imageRepository(input.project, service, definition.image)}:${tag}`;
  }
  const port = input.tunnelPort ? loopbackPortOverride(config, input.tunnelPort) : null;
  return { yaml: renderOverride(images, port), images };
}
