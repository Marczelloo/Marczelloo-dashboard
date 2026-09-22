import "server-only";

import { getBranch, parseGitHubUrl } from "@/server/github/client";

export async function resolveBranchHead(githubUrl: string, branch: string): Promise<string> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error("Invalid GitHub repository address.");
  const result = await getBranch(parsed.owner, parsed.repo, branch);
  if (!/^[0-9a-f]{40}$/.test(result.commit.sha)) throw new Error(`GitHub returned no SHA for branch ${branch}.`);
  return result.commit.sha;
}
