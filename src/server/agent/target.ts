import type { DeployTarget } from "@agent/types";
import type { DeploymentConfig } from "@/server/deployments/config";

export function toAgentTarget(config: DeploymentConfig): DeployTarget {
  return {
    projectId: config.projectId,
    composeProject: config.composeProject,
    repoPath: config.repoPath,
    githubUrl: config.githubUrl,
    branch: config.branch,
    composeFile: config.composeFile,
    profiles: config.profiles,
    tunnel: config.tunnel?.enabled ? { hostname: config.tunnel.hostname, localPort: config.tunnel.localPort } : null,
  };
}
