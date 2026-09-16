import "server-only";

import { getBranch, parseGitHubUrl } from "@/server/github/client";

export async function resolveBranchHead(githubUrl: string, branch: string): Promise<string> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error("Nieprawidłowy adres repozytorium GitHub.");
  const result = await getBranch(parsed.owner, parsed.repo, branch);
  if (!/^[0-9a-f]{40}$/.test(result.commit.sha)) throw new Error(`GitHub nie zwrócił SHA gałęzi ${branch}.`);
  return result.commit.sha;
}
