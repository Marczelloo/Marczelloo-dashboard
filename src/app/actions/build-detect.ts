"use server";

import { z } from "zod";
import { isDemoMode } from "@/lib/demo-mode";
import { detectBuild, type BuildSpec, type DeploymentRuntimeKind } from "@/server/deployments/detect";
import { getContents, parseGitHubUrl } from "@/server/github";
import { requireAuth } from "@/server/lib/auth";
import type { GitHubContent } from "@/types/github";

const inputSchema = z.object({
  githubUrl: z.string().min(1).max(300),
  branch: z.string().min(1).max(120).regex(/^[A-Za-z0-9._/-]+$/),
  runtime: z.enum(["web", "worker", "bot", "stack"]),
});

async function readFile(owner: string, repo: string, name: string, ref: string, files: string[]): Promise<string | null> {
  if (!files.includes(name)) return null;
  const content = await getContents(owner, repo, name, ref).catch(() => null);
  if (!content || Array.isArray(content) || content.type !== "file" || !content.content || content.size > 512_000) return null;
  return Buffer.from(content.content, "base64").toString("utf8");
}

/** Reads the repository root through the GitHub App and suggests how to build it. */
export async function detectRepositoryBuildAction(input: z.input<typeof inputSchema>): Promise<{ success: boolean; spec: BuildSpec | null; reasons: string[]; error?: string }> {
  try {
    if (isDemoMode()) return { success: true, spec: null, reasons: ["Wykrywanie jest wyłączone w trybie demo."] };
    await requireAuth();
    const parsed = inputSchema.parse(input);
    const repository = parseGitHubUrl(parsed.githubUrl);
    if (!repository) return { success: false, spec: null, reasons: [], error: "To nie jest adres repozytorium GitHub." };

    const root = await getContents(repository.owner, repository.repo, "", parsed.branch);
    const files = (Array.isArray(root) ? root : [root]).map((entry: GitHubContent) => (entry.type === "dir" ? `${entry.name}/` : entry.name));
    const [packageJsonText, dockerfile, lowerDockerfile, requirementsTxt, pyprojectToml] = await Promise.all([
      readFile(repository.owner, repository.repo, "package.json", parsed.branch, files),
      readFile(repository.owner, repository.repo, "Dockerfile", parsed.branch, files),
      readFile(repository.owner, repository.repo, "dockerfile", parsed.branch, files),
      readFile(repository.owner, repository.repo, "requirements.txt", parsed.branch, files),
      readFile(repository.owner, repository.repo, "pyproject.toml", parsed.branch, files),
    ]);
    let packageJson: unknown = null;
    try {
      packageJson = packageJsonText ? JSON.parse(packageJsonText) : null;
    } catch {
      packageJson = null;
    }
    const result = detectBuild(
      { files, packageJson, dockerfileContent: dockerfile ?? lowerDockerfile, requirementsTxt, pyprojectToml },
      parsed.runtime as DeploymentRuntimeKind
    );
    if (packageJsonText && !packageJson) result.reasons.push("package.json nie jest poprawnym JSON-em — pominięty.");
    return { success: true, ...result };
  } catch (error) {
    return { success: false, spec: null, reasons: [], error: error instanceof Error ? error.message : "Nie udało się odczytać repozytorium." };
  }
}
