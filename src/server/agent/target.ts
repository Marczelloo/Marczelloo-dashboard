import type { DeployTarget } from "@agent/types";
import type { DeploymentConfig } from "@/server/deployments/config";
import { parseLocalPortFromService } from "@/server/deployments/routing";
import { renderGeneratedCompose } from "@/server/deployments/templates";

/** True when the dashboard renders the compose file instead of reading one from the repository. */
export function usesGeneratedCompose(config: DeploymentConfig): boolean {
  return Boolean(config.build && config.build.kind !== "compose");
}

export function toAgentTarget(config: DeploymentConfig, probe = false): DeployTarget {
  return {
    projectId: config.projectId,
    composeProject: config.composeProject,
    repoPath: config.repoPath,
    githubUrl: config.githubUrl,
    branch: config.branch,
    composeFile: config.composeFile,
    profiles: config.profiles,
    tunnel: config.tunnel?.enabled ? { hostname: config.tunnel.hostname, localPort: config.tunnel.localPort, probe } : null,
    generatedCompose: usesGeneratedCompose(config)
      ? renderGeneratedCompose({ spec: config.build!, composeProject: config.composeProject, repoPath: config.repoPath, localPort: config.tunnel?.enabled ? config.tunnel.localPort : null })
      : null,
  };
}

export type TunnelRouteState = "matches" | "missing" | "differs";

/** Where the public hostname points compared with the port the deploy will publish. */
export function tunnelRouteState(routes: Array<{ hostname: string; service: string }>, tunnel: { hostname: string; localPort: number }): TunnelRouteState {
  const route = routes.find((candidate) => candidate.hostname.toLowerCase() === tunnel.hostname.toLowerCase());
  if (!route) return "missing";
  return parseLocalPortFromService(route.service) === tunnel.localPort ? "matches" : "differs";
}
