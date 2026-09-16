import { spawn } from "node:child_process";
import type { CommandStep } from "./git";
import type { CommandResult } from "./pipeline";

const MAX_CAPTURE = 4 * 1024 * 1024;

export function runCommand(step: CommandStep, onOutput: (chunk: string) => void): Promise<CommandResult> {
  return new Promise((resolve) => {
    // Never inherit the agent environment: Compose prefers process variables over
    // a project's .env, so AGENT_TOKEN, NODE_ENV or PROJECTS_DIR would leak into apps.
    // Cast: Next.js augments ProcessEnv with a required NODE_ENV, which children must not get.
    const env = { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin", HOME: process.env.HOME ?? "/tmp", ...step.env } as unknown as NodeJS.ProcessEnv;
    const child = spawn(step.command, step.args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      onOutput(`\n[agent] Przekroczono limit czasu ${Math.round(step.timeoutMs / 1000)} s — przerywam.\n`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, step.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (stdout.length < MAX_CAPTURE) stdout += text;
      if (!step.quiet) onOutput(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (stderr.length < MAX_CAPTURE) stderr += text;
      onOutput(text);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
