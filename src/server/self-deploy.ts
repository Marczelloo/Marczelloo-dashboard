/**
 * Self-deployment launcher.
 *
 * The actual deployment is intentionally executed by scripts/self-deploy.sh
 * as a detached host process. Recreating the dashboard container must not
 * terminate the worker that is responsible for restarting it.
 */

import { shellQuote } from "./runner/safe-paths";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;
const DASHBOARD_REPO_PATH = process.env.DASHBOARD_REPO_PATH || "/home/Marczelloo_pi/projects/Marczelloo-dashboard";
const STATUS_FILE = `${DASHBOARD_REPO_PATH}/.deploy-status.json`;

interface SelfDeployOptions {
  projectId?: string;
  triggeredBy: string;
  branch?: string;
  commit?: string;
  commitMessage?: string;
  author?: string;
  compareUrl?: string;
}

interface SelfDeployResult {
  success: boolean;
  error?: string;
  output?: string;
  jobId?: string;
  logFile?: string;
}

interface ShellResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  ssh_enabled?: boolean;
}

function safeBranch(value: string | undefined): string {
  const branch = value || "main";
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.startsWith("-") || branch.includes("..")) {
    throw new Error("Invalid deployment branch");
  }
  return branch;
}

function createJobId(commit?: string): string {
  const safeCommit = (commit || "unknown").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12) || "unknown";
  return `self-${Date.now()}-${safeCommit}`;
}

async function execShell(command: string, timeout = 15000): Promise<ShellResult> {
  if (!RUNNER_TOKEN) return { success: false, stderr: "RUNNER_TOKEN not configured" };

  try {
    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({ command, timeout }),
    });

    const result = await response.json().catch(() => ({}));
    return {
      success: response.ok && (result.success === true || result.exit_code === 0),
      stdout: result.stdout,
      stderr: result.stderr || (!response.ok ? `Runner returned ${response.status}` : undefined),
      ssh_enabled: result.ssh_enabled,
    };
  } catch (error) {
    return { success: false, stderr: error instanceof Error ? error.message : "Runner connection failed" };
  }
}

async function updateDeploymentStatus(input: {
  status: "deploying" | "success" | "failed";
  message: string;
  commit?: string;
  jobId: string;
  logFile: string;
  step: string;
  progress: number;
  rollback?: boolean;
}): Promise<ShellResult> {
  const statusData = JSON.stringify({
    ...input,
    timestamp: new Date().toISOString(),
  });
  const encoded = Buffer.from(statusData, "utf8").toString("base64");
  const tempFile = `${STATUS_FILE}.tmp.${input.jobId}`;
  const command =
    `mkdir -p ${shellQuote(DASHBOARD_REPO_PATH)} && ` +
    `printf '%s' ${shellQuote(encoded)} | base64 -d > ${shellQuote(tempFile)} && ` +
    `mv -f ${shellQuote(tempFile)} ${shellQuote(STATUS_FILE)}`;

  return execShell(command);
}

async function launchDetachedSelfDeploy(options: SelfDeployOptions): Promise<SelfDeployResult> {
  const branch = safeBranch(options.branch);
  const jobId = createJobId(options.commit);
  const logFile = `/tmp/${jobId}.log`;
  const workerFile = `/tmp/${jobId}.sh`;
  const scriptPath = `${DASHBOARD_REPO_PATH}/scripts/self-deploy.sh`;

  if (!RUNNER_TOKEN) {
    return { success: false, error: "RUNNER_TOKEN not configured", jobId, logFile };
  }

  const initialStatus = await updateDeploymentStatus({
    status: "deploying",
    message: "Deployment queued",
    commit: options.commit,
    jobId,
    logFile,
    step: "queued",
    progress: 0,
  });

  if (!initialStatus.success) {
    return {
      success: false,
      error: initialStatus.stderr || "Could not write deployment status",
      jobId,
      logFile,
    };
  }

  const command =
    `cp ${shellQuote(scriptPath)} ${shellQuote(workerFile)} && chmod 700 ${shellQuote(workerFile)} && ` +
    `nohup bash ${shellQuote(workerFile)} ` +
    `--repo ${shellQuote(DASHBOARD_REPO_PATH)} ` +
    `--branch ${shellQuote(branch)} ` +
    `--status-file ${shellQuote(STATUS_FILE)} ` +
    `--log-file ${shellQuote(logFile)} ` +
    `--commit ${shellQuote(options.commit || "")} ` +
    `--message ${shellQuote((options.commitMessage || "").slice(0, 500))} ` +
    `--job-id ${shellQuote(jobId)} ` +
    `> ${shellQuote(logFile)} 2>&1 < /dev/null & echo $!`;
  const result = await execShell(command);

  if (!result.success || result.ssh_enabled === false) {
    const error = result.ssh_enabled === false
      ? "Runner SSH access is not configured; refusing self-deploy inside the runner container"
      : result.stderr || "Failed to start detached deployment worker";
    await updateDeploymentStatus({
      status: "failed",
      message: error,
      commit: options.commit,
      jobId,
      logFile,
      step: "queue",
      progress: 100,
    });
    return { success: false, error, jobId, logFile };
  }

  console.log(`[SelfDeploy] Detached worker started: job=${jobId} pid=${result.stdout?.trim() || "unknown"}`);
  return {
    success: true,
    output: result.stdout,
    jobId,
    logFile,
  };
}

/**
 * Launch a detached self-deploy worker and return after the worker is queued.
 * This is kept async for callers that want to confirm the worker was started;
 * it does not wait for the build or container restart.
 */
export async function performSafeSelfDeploy(options: SelfDeployOptions): Promise<SelfDeployResult> {
  return launchDetachedSelfDeploy(options);
}

/** Start the detached worker; resolves once the worker is queued, not finished. */
export function startBackgroundSelfDeploy(options: SelfDeployOptions): Promise<SelfDeployResult> {
  return performSafeSelfDeploy(options).catch((error) => {
    console.error("[SelfDeploy] Worker launch error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Worker launch failed" };
  });
}
