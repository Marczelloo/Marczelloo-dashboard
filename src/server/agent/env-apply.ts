import "server-only";

import { appImport, deploys, projects, services } from "@/server/atlashub";
import { getDeploymentConfig, type DeploymentConfig } from "@/server/deployments/config";
import { envFileFingerprint, envFileKeys, envFilePayload, latestVersionOfFile, nextVersionNumber } from "@/server/env/file-versions";
import { enqueueAgentJob } from "./client";
import { prepareTunnelProbe, resolveEdge } from "./deploy";
import { agentLogRef } from "./refs";
import { toAgentTarget } from "./target";

/** Deployment config of the agent-managed project whose repository holds this env file. */
export async function findAgentProjectByRepoPath(repoPath: string): Promise<DeploymentConfig | null> {
  const normalized = repoPath.replace(/\/+$/, "");
  for (const project of await projects.getProjects()) {
    const config = await getDeploymentConfig(project.id);
    if (config?.engine === "agent" && config.repoPath.replace(/\/+$/, "") === normalized) return config;
  }
  return null;
}

/** Store a file version unless the newest version of that file already has this content. */
export async function recordEnvFileVersion(input: { projectId: string; fileName: string; content: string; note: string; createdBy: string }): Promise<number> {
  const versions = await appImport.listEnvVersions(input.projectId);
  const fingerprint = envFileFingerprint(input.fileName, input.content);
  const latest = latestVersionOfFile(versions, input.fileName);
  if (latest?.fingerprint === fingerprint) return latest.version;
  const version = nextVersionNumber(versions);
  await appImport.insertEnvVersion({
    projectId: input.projectId,
    version,
    keys: envFileKeys(input.fileName, input.content),
    payload: envFilePayload(input.fileName, input.content),
    fingerprint,
    note: input.note.slice(0, 200),
    createdBy: input.createdBy.slice(0, 100),
  });
  return version;
}

async function deployServiceId(config: DeploymentConfig, preferredServiceId?: string | null): Promise<string> {
  const rows = await services.getServicesByProjectId(config.projectId);
  const preferred = preferredServiceId ? rows.find((row) => row.id === preferredServiceId) : undefined;
  const service = preferred ?? rows.find((row) => row.type === "docker" && row.compose_project === config.composeProject) ?? rows.find((row) => row.type === "docker");
  if (!service) throw new Error("The project has no Docker service yet. Deploy it first.");
  return service.id;
}

/**
 * The agent writes the file, recreates the project on its current release and
 * restores `previous` when the health gate fails, so no host command can leave
 * a half-applied env behind.
 */
export async function queueAgentEnvApply(input: {
  config: DeploymentConfig;
  serviceId?: string | null;
  triggeredBy: string;
  fileName: string;
  content: string;
  previous: string | null;
}): Promise<{ deployId: string; jobId: string }> {
  const serviceId = await deployServiceId(input.config, input.serviceId);
  const probe = await prepareTunnelProbe(input.config, false).catch(() => false);
  const deploy = await deploys.createDeploy({ service_id: serviceId, triggered_by: input.triggeredBy });
  try {
    const job = await enqueueAgentJob({
      kind: "apply-env",
      target: toAgentTarget(input.config, probe, await resolveEdge(input.config)),
      deployId: deploy.id,
      triggeredBy: input.triggeredBy.slice(0, 100),
      envFile: { name: input.fileName, content: input.content, previous: input.previous },
    });
    await deploys.setDeployLogFile(deploy.id, agentLogRef(job.id));
    return { deployId: deploy.id, jobId: job.id };
  } catch (error) {
    await deploys.completeDeploy(deploy.id, false, { error_message: error instanceof Error ? error.message : "The agent refused the job." });
    throw error;
  }
}
