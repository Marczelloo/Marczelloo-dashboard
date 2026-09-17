import "server-only";

import { deploys } from "@/server/atlashub";
import type { DeploymentConfig } from "@/server/deployments/config";
import { resolveBranchHead } from "@/server/deployments/commit";
import type { DeployTarget } from "@agent/types";
import { edgeServicesForProject } from "@/server/deployments/edge";
import { edgeSettings, listCloudflareTunnelRoutes, resolveContainerOrigin, updateCloudflareTunnelRoute } from "@/server/deployments/host";
import { getRepositoryCloneToken } from "@/server/github/client";
import { enqueueAgentJob, getAgentHost, getAgentJob, getAgentStatus, readAgentJobLogToEnd } from "./client";
import { agentLogRef } from "./refs";
import { toAgentTarget, tunnelRouteState } from "./target";

const describeError = (error: unknown) => (error instanceof Error ? error.message : "Agent odrzucił zadanie.");

/**
 * Decide whether the health gate may probe the public hostname. An existing
 * route is never switched before the deploy (the old container still serves
 * it); the dashboard switches it after a successful job. A hostname without
 * any route gets one now, because nothing is served there yet.
 */
export async function prepareTunnelProbe(config: DeploymentConfig, createMissingRoute: boolean): Promise<boolean> {
  if (!config.tunnel?.enabled) return false;
  const ingress = await listCloudflareTunnelRoutes();
  if (!ingress.configured) return false;
  const expected = edgeSettings().containerOrigins ? await resolveContainerOrigin(config.tunnel.localPort).catch(() => null) : null;
  const state = tunnelRouteState(ingress.routes, config.tunnel, expected);
  if (state === "matches") return true;
  if (state === "missing" && createMissingRoute) {
    await updateCloudflareTunnelRoute({ hostname: config.tunnel.hostname, localPort: config.tunnel.localPort });
    return true;
  }
  return false;
}

/**
 * Services of the project that tunnel routes reach; they join the edge network
 * on every job, so a deploy, rollback or env apply never drops them from it.
 */
export async function resolveEdge(config: DeploymentConfig): Promise<DeployTarget["edge"]> {
  const { network } = edgeSettings();
  if (!network) return null;
  const [ingress, host, status] = await Promise.all([listCloudflareTunnelRoutes(), getAgentHost(), getAgentStatus()]);
  if (ingress.error) throw new Error(`Nie można ustalić usług dla sieci ${network}: ${ingress.error}`);
  const containers = status.projects[config.composeProject]?.containers ?? [];
  return { network, services: edgeServicesForProject(ingress.routes, host.publishedPorts, containers) };
}

export async function queueAgentDeployment(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; commitSha?: string }): Promise<{ deployId: string; jobId: string; sha: string }> {
  const { config } = input;
  const sha = input.commitSha && /^[0-9a-f]{40}$/.test(input.commitSha) ? input.commitSha : await resolveBranchHead(config.githubUrl, config.branch);
  const probe = await prepareTunnelProbe(config, true);

  const deploy = await deploys.createDeploy({ service_id: input.serviceId, triggered_by: input.triggeredBy, commit_sha: sha });
  try {
    // Fallback only: the agent asks /api/agent/token for a fresh token when the job starts.
    const token = await getRepositoryCloneToken(config.githubUrl).catch(() => null);
    const job = await enqueueAgentJob({ kind: "deploy", target: toAgentTarget(config, probe, await resolveEdge(config)), sha, deployId: deploy.id, triggeredBy: input.triggeredBy.slice(0, 100), token });
    await deploys.setDeployLogFile(deploy.id, agentLogRef(job.id));
    return { deployId: deploy.id, jobId: job.id, sha };
  } catch (error) {
    await deploys.completeDeploy(deploy.id, false, { error_message: describeError(error) });
    throw error;
  }
}

export async function queueAgentRollback(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; sha?: string }): Promise<{ deployId: string; jobId: string; sha: string }> {
  const probe = await prepareTunnelProbe(input.config, false);
  const deploy = await deploys.createDeploy({ service_id: input.serviceId, triggered_by: input.triggeredBy, ...(input.sha ? { commit_sha: input.sha } : {}) });
  try {
    const job = await enqueueAgentJob({ kind: "rollback", target: toAgentTarget(input.config, probe, await resolveEdge(input.config)), sha: input.sha ?? null, deployId: deploy.id, triggeredBy: input.triggeredBy.slice(0, 100) });
    await deploys.setDeployLogFile(deploy.id, agentLogRef(job.id));
    return { deployId: deploy.id, jobId: job.id, sha: job.sha };
  } catch (error) {
    await deploys.completeDeploy(deploy.id, false, { error_message: describeError(error) });
    throw error;
  }
}

export async function readAgentDeployLog(jobId: string): Promise<{ log: string; isComplete: boolean; success: boolean }> {
  const job = await getAgentJob(jobId);
  const log = await readAgentJobLogToEnd(jobId, 0);
  return {
    log: log.content.slice(-60_000),
    isComplete: job.status !== "queued" && job.status !== "running",
    success: job.status === "succeeded",
  };
}
