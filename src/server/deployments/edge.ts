import { parseLocalPortFromService } from "./routing";

/**
 * Edge network routing: the tunnel connector sits on a shared Docker network
 * and reaches containers by name instead of through ports published on the
 * host's loopback interface.
 */

export interface PortBinding {
  container: string;
  hostPort: number;
  containerPort: number;
}

export interface ProjectContainer {
  name: string;
  service: string;
}

const CONTAINER_SERVICE = /^https?:\/\/([A-Za-z0-9][A-Za-z0-9_.-]*):(\d{1,5})\/?$/i;

/** Container target of a tunnel service, or null for loopback and other services. */
export function parseContainerService(service: string): { container: string; port: number } | null {
  if (parseLocalPortFromService(service) !== null) return null;
  const match = CONTAINER_SERVICE.exec(service.trim());
  if (!match || match[1].toLowerCase() === "localhost" || /^[\d.]+$/.test(match[1])) return null;
  return { container: match[1], port: Number(match[2]) };
}

export function containerService(container: string, port: number): string {
  return `http://${container}:${port}`;
}

/** The container behind a loopback port, from the ports Docker publishes. */
export function bindingForPort(bindings: PortBinding[], hostPort: number): PortBinding | null {
  return bindings.find((binding) => binding.hostPort === hostPort) ?? null;
}

/**
 * Compose services of one project that a tunnel route targets, either through
 * a published loopback port or already by container name.
 */
export function edgeServicesForProject(routes: Array<{ service: string }>, bindings: PortBinding[], containers: ProjectContainer[]): string[] {
  const byName = new Map(containers.map((container) => [container.name, container.service]));
  const services = new Set<string>();
  for (const route of routes) {
    const port = parseLocalPortFromService(route.service);
    const container = port !== null ? bindingForPort(bindings, port)?.container : parseContainerService(route.service)?.container;
    const service = container ? byName.get(container) : undefined;
    if (service) services.add(service);
  }
  return [...services].sort();
}

/**
 * Service and container port behind a project's tunnel port, with the same
 * rule the agent uses: the only published port, else the one published on
 * localPort, else the only port whose container side is localPort.
 */
export function pickTunnelPort(ports: Array<{ service: string; published: number | null; target: number }>, localPort: number): { service: string; port: number } | null {
  const published = ports.filter((entry) => entry.published !== null);
  const byPublished = published.filter((entry) => entry.published === localPort);
  const byTarget = ports.filter((entry) => entry.target === localPort);
  const chosen = published.length === 1 ? published[0] : byPublished.length === 1 ? byPublished[0] : byTarget.length === 1 ? byTarget[0] : null;
  return chosen ? { service: chosen.service, port: chosen.target } : null;
}

export interface EdgeTranslation {
  hostname: string | null;
  from: string;
  to: string;
}

/**
 * Rewrites loopback ingress services to container targets. Ports served by
 * something other than a container (the static site server) are mapped
 * through `extra`, e.g. { 8080: "http://mz-static:8080" }.
 */
export function translateIngress<T extends { hostname?: string; service: string }>(
  rules: T[],
  bindings: PortBinding[],
  extra: Record<number, string> = {}
): { rules: T[]; changes: EdgeTranslation[]; unresolved: EdgeTranslation[] } {
  const changes: EdgeTranslation[] = [];
  const unresolved: EdgeTranslation[] = [];
  const translated = rules.map((rule) => {
    const port = parseLocalPortFromService(rule.service);
    if (port === null) return rule;
    const binding = bindingForPort(bindings, port);
    const to = extra[port] ?? (binding ? containerService(binding.container, binding.containerPort) : null);
    if (!to) {
      unresolved.push({ hostname: rule.hostname ?? null, from: rule.service, to: "" });
      return rule;
    }
    changes.push({ hostname: rule.hostname ?? null, from: rule.service, to });
    return { ...rule, service: to };
  });
  return { rules: translated, changes, unresolved };
}
