import { parseLocalPortFromService } from "@/server/deployments/routing";
import type { ContainerFact, IngressRule } from "../types";

export type RouteTarget =
  | { kind: "container"; composeProject: string | null; service: string | null; containerName: string; containerPort: number }
  | { kind: "host"; port: number }
  | { kind: "status"; status: string }
  | { kind: "other"; url: string };

export interface RouteMatch {
  rule: IngressRule;
  target: RouteTarget;
}

export function matchIngressRoutes(rules: IngressRule[], containers: ContainerFact[]): RouteMatch[] {
  const running = containers.filter((container) => container.status === "running" || container.status === "restarting");

  return rules.map((rule): RouteMatch => {
    if (rule.service.startsWith("http_status:")) {
      return { rule, target: { kind: "status", status: rule.service.slice("http_status:".length) } };
    }
    const port = parseLocalPortFromService(rule.service);
    if (port === null) return { rule, target: { kind: "other", url: rule.service } };

    for (const container of running) {
      const binding = container.ports.find((candidate) => candidate.hostPort === port && candidate.hostIp !== "::");
      if (binding) {
        return {
          rule,
          target: { kind: "container", composeProject: container.composeProject, service: container.composeService, containerName: container.name, containerPort: binding.containerPort },
        };
      }
    }
    return { rule, target: { kind: "host", port } };
  });
}
