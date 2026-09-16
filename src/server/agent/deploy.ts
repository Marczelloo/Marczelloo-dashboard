import "server-only";

import { deploys } from "@/server/atlashub";
import type { DeploymentConfig } from "@/server/deployments/config";
import { resolveBranchHead } from "@/server/deployments/commit";
import { updateCloudflareTunnelRoute } from "@/server/deployments/host";
import { getRepositoryCloneToken } from "@/server/github/client";
import { enqueueAgentJob, getAgentJob, readAgentJobLog } from "./client";
import { agentLogRef } from "./refs";
import { toAgentTarget } from "./target";

const describeError = (error: unknown) => (error instanceof Error ? error.message : "Agent odrzucił zadanie.");

export async function queueAgentDeployment(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; commitSha?: string }): Promise<{ deployId: string; jobId: string; sha: string }> {
  const { config } = input;
  const sha = input.commitSha && /^[0-9a-f]{40}$/.test(input.commitSha) ? input.commitSha : await resolveBranchHead(config.githubUrl, config.branch);

  // The health gate probes the public hostname, so the route must exist before the job runs.
  if (config.tunnel?.enabled) {
    await updateCloudflareTunnelRoute({ hostname: config.tunnel.hostname, localPort: config.tunnel.localPort });
  }

  const deploy = await deploys.createDeploy({ service_id: input.serviceId, triggered_by: input.triggeredBy, commit_sha: sha });
  try {
    const token = await getRepositoryCloneToken(config.githubUrl).catch(() => null);
    const job = await enqueueAgentJob({ kind: "deploy", target: toAgentTarget(config), sha, deployId: deploy.id, triggeredBy: input.triggeredBy.slice(0, 100), token });
    await deploys.setDeployLogFile(deploy.id, agentLogRef(job.id));
    return { deployId: deploy.id, jobId: job.id, sha };
  } catch (error) {
    await deploys.completeDeploy(deploy.id, false, { error_message: describeError(error) });
    throw error;
  }
}

export async function queueAgentRollback(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; sha?: string }): Promise<{ deployId: string; jobId: string; sha: string }> {
  const deploy = await deploys.createDeploy({ service_id: input.serviceId, triggered_by: input.triggeredBy, ...(input.sha ? { commit_sha: input.sha } : {}) });
  try {
    const job = await enqueueAgentJob({ kind: "rollback", target: toAgentTarget(input.config), sha: input.sha ?? null, deployId: deploy.id, triggeredBy: input.triggeredBy.slice(0, 100) });
    await deploys.setDeployLogFile(deploy.id, agentLogRef(job.id));
    return { deployId: deploy.id, jobId: job.id, sha: job.sha };
  } catch (error) {
    await deploys.completeDeploy(deploy.id, false, { error_message: describeError(error) });
    throw error;
  }
}

export async function readAgentDeployLog(jobId: string): Promise<{ log: string; isComplete: boolean; success: boolean }> {
  const [job, log] = await Promise.all([getAgentJob(jobId), readAgentJobLog(jobId, 0)]);
  return {
    log: log.content.slice(-60_000),
    isComplete: job.status !== "queued" && job.status !== "running",
    success: job.status === "succeeded",
  };
}
