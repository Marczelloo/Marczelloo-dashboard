import "server-only";

import { getAgentProject } from "@/server/agent/client";
import { agentLogRef } from "@/server/agent/refs";
import { SELF_COMPOSE_PROJECT } from "@/server/deployments/compose-stack";
import { listDeploymentConfigs } from "@/server/deployments/config";
import { getCommit, parseGitHubUrl } from "@/server/github/client";

export interface SelfVersion {
  commit: string;
  shortCommit: string;
  author: string | null;
  committedAt: string | null;
  subject: string | null;
  branch: string | null;
  deployedAt: string;
}

export interface SelfDeployment {
  /** Release the running dashboard was deployed from, if the agent knows it. */
  commit: string | null;
  activeJob: { jobId: string; kind: string; logFile: string } | null;
}

let commitCache: { sha: string; value: Pick<SelfVersion, "author" | "committedAt" | "subject"> } | null = null;

/** The dashboard's own version comes from the agent's release history, not from a Git checkout on the host. */
export async function getSelfVersion(): Promise<SelfVersion | null> {
  const [project, configs] = await Promise.all([getAgentProject(SELF_COMPOSE_PROJECT), listDeploymentConfigs()]);
  const release = project.releases[0];
  if (!release) return null;
  const config = configs.find((candidate) => candidate.composeProject === SELF_COMPOSE_PROJECT);

  if (commitCache?.sha !== release.sha) {
    let details: Pick<SelfVersion, "author" | "committedAt" | "subject"> = { author: null, committedAt: null, subject: null };
    const repository = config ? parseGitHubUrl(config.githubUrl) : null;
    if (repository) {
      try {
        const commit = await getCommit(repository.owner, repository.repo, release.sha);
        details = { author: commit.commit.author.name, committedAt: commit.commit.author.date, subject: commit.commit.message.split("\n")[0] };
      } catch {
        // GitHub may be unreachable; the SHA alone still identifies the version.
      }
    }
    commitCache = { sha: release.sha, value: details };
  }

  return {
    commit: release.sha,
    shortCommit: release.sha.slice(0, 8),
    ...commitCache.value,
    branch: config?.branch ?? null,
    deployedAt: release.deployedAt,
  };
}

export async function getSelfDeployment(): Promise<SelfDeployment> {
  const project = await getAgentProject(SELF_COMPOSE_PROJECT);
  const job = project.activeJob;
  return {
    commit: project.releases[0]?.sha ?? null,
    activeJob: job ? { jobId: job.id, kind: job.kind, logFile: agentLogRef(job.id) } : null,
  };
}
