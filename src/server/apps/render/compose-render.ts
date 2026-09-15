import { stringify } from "yaml";
import type { ComposeConfig, ContainerFact } from "../types";

export const DEFAULT_LOGGING = { driver: "json-file", options: { "max-size": "10m", "max-file": "3" } } as const;

export function renderImportedCompose(config: ComposeConfig, context: { project: string; projectId: string }): ComposeConfig {
  const services = Object.fromEntries(
    Object.entries(config.services).map(([name, service]) => [
      name,
      {
        ...service,
        labels: { ...(service.labels ?? {}), "dev.marczelloo.project-id": context.projectId, "dev.marczelloo.managed": "imported" },
        logging: service.logging ?? DEFAULT_LOGGING,
      },
    ])
  );
  const volumes = config.volumes
    ? Object.fromEntries(Object.entries(config.volumes).map(([key, volume]) => [key, { ...(volume ?? {}), name: volume?.name ?? `${context.project}_${key}` }]))
    : undefined;

  return { ...config, name: context.project, services, ...(volumes ? { volumes } : {}) };
}

export function toComposeYaml(config: ComposeConfig): string {
  return stringify(config, { lineWidth: 0 });
}

export interface DryRunCheck {
  service: string;
  check: "service" | "image" | "volumes" | "ports" | "env";
  ok: boolean;
  detail: string;
}

export interface DryRunReport {
  ok: boolean;
  checks: DryRunCheck[];
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

export function dryRunAgainstContainers(rendered: ComposeConfig, containers: ContainerFact[], imageEnv: Record<string, Record<string, string>>): DryRunReport {
  const checks: DryRunCheck[] = [];
  const running = containers.filter((container) => !container.oneOff && (container.status === "running" || container.status === "restarting"));

  for (const container of running) {
    const serviceName = container.composeService ?? "";
    const service = rendered.services[serviceName];
    if (!service) {
      checks.push({ service: container.name, check: "service", ok: false, detail: `Usługa „${serviceName}” nie istnieje w konfiguracji (inny profil lub plik?).` });
      continue;
    }

    const expectedImage = service.image ?? `${rendered.name}-${serviceName}`;
    checks.push({ service: container.name, check: "image", ok: container.image === expectedImage, detail: container.image === expectedImage ? expectedImage : `Kontener: ${container.image}, konfiguracja: ${expectedImage}` });

    const expectedMounts = (service.volumes ?? [])
      .filter((volume) => volume.type === "volume" || volume.type === "bind")
      .map((volume) => (volume.type === "volume" ? `volume:${rendered.volumes?.[volume.source ?? ""]?.name ?? volume.source}->${volume.target}` : `bind:${volume.source}->${volume.target}`));
    const actualMounts = container.mounts
      .filter((mount) => (mount.type === "volume" && !/^[0-9a-f]{64}$/.test(mount.name ?? "")) || mount.type === "bind")
      .map((mount) => (mount.type === "volume" ? `volume:${mount.name}->${mount.destination}` : `bind:${mount.source}->${mount.destination}`));
    const mountsOk = sameSet(expectedMounts, actualMounts);
    checks.push({ service: container.name, check: "volumes", ok: mountsOk, detail: mountsOk ? `${actualMounts.length} montowań zgodnych` : `Kontener: ${actualMounts.join(", ") || "brak"}; konfiguracja: ${expectedMounts.join(", ") || "brak"}` });

    const expectedPorts = (service.ports ?? []).map((port) => `${port.host_ip || "0.0.0.0"}:${port.published}->${port.target}/${port.protocol || "tcp"}`);
    const actualPorts = container.ports.filter((port) => port.hostIp !== "::").map((port) => `${port.hostIp}:${port.hostPort}->${port.containerPort}/${port.protocol}`);
    const portsOk = sameSet(expectedPorts, actualPorts);
    checks.push({ service: container.name, check: "ports", ok: portsOk, detail: portsOk ? `${actualPorts.length} portów zgodnych` : `Kontener: ${actualPorts.join(", ") || "brak"}; konfiguracja: ${expectedPorts.join(", ") || "brak"}` });

    const defaults = imageEnv[container.imageId] ?? {};
    const environment = service.environment ?? {};
    const ownKeys = Object.keys(container.env).filter((key) => defaults[key] !== container.env[key]);
    const missing = ownKeys.filter((key) => !(key in environment));
    const changed = ownKeys.filter((key) => key in environment && environment[key] !== container.env[key]);
    const envOk = missing.length === 0 && changed.length === 0;
    checks.push({
      service: container.name,
      check: "env",
      ok: envOk,
      detail: envOk ? `${ownKeys.length} zmiennych zgodnych` : [missing.length ? `brak w konfiguracji: ${missing.join(", ")}` : "", changed.length ? `inna wartość: ${changed.join(", ")}` : ""].filter(Boolean).join("; "),
    });
  }

  return { ok: checks.every((check) => check.ok), checks };
}
