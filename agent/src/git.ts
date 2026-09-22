export interface CommandStep {
  label: string;
  command: "git" | "docker";
  args: string[];
  env?: Record<string, string>;
  timeoutMs: number;
  /** Do not copy stdout into the job log (output can contain env values). */
  quiet?: boolean;
  allowFailure?: boolean;
  /** Fail the step with this message when stdout is not empty. */
  failOnOutput?: string;
}

export const SHA = /^[0-9a-f]{40}$/;

export function repositoryHttpsUrl(githubUrl: string): string {
  const match = /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(githubUrl.trim());
  if (!match) throw new Error("The agent supports GitHub repositories only.");
  return `https://github.com/${match[1]}/${match[2]}.git`;
}

export function gitAuthEnv(token: string | null): Record<string, string> {
  const base = { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
  if (!token) return base;
  return {
    ...base,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`, "utf8").toString("base64")}`,
  };
}

function requireSha(sha: string) {
  if (!SHA.test(sha)) throw new Error("Invalid commit SHA (40 characters required).");
}

export function gitCheckoutStep(repoPath: string, sha: string): CommandStep {
  requireSha(sha);
  return { label: `Git checkout ${sha.slice(0, 7)}`, command: "git", args: ["-C", repoPath, "checkout", "--detach", sha], env: gitAuthEnv(null), timeoutMs: 120_000 };
}

export function gitSyncSteps(input: { repoPath: string; githubUrl: string; sha: string; token: string | null; repoExists: boolean }): CommandStep[] {
  requireSha(input.sha);
  const url = repositoryHttpsUrl(input.githubUrl);
  const env = gitAuthEnv(input.token);
  const steps: CommandStep[] = [];

  if (input.repoExists) {
    steps.push({
      label: "Sprawdzenie lokalnych zmian",
      command: "git",
      args: ["-C", input.repoPath, "status", "--porcelain", "--untracked-files=no"],
      env,
      timeoutMs: 60_000,
      quiet: true,
      failOnOutput: "The server repository has local changes in tracked files. The agent will not overwrite them.",
    });
  } else {
    steps.push({ label: "Git clone", command: "git", args: ["clone", "--no-checkout", url, input.repoPath], env, timeoutMs: 600_000 });
  }

  steps.push({ label: `Git fetch ${input.sha.slice(0, 7)}`, command: "git", args: ["-C", input.repoPath, "fetch", "--no-tags", url, input.sha], env, timeoutMs: 600_000 });
  steps.push(gitCheckoutStep(input.repoPath, input.sha));
  return steps;
}
