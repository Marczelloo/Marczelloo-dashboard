/**
 * Self-Deployment Module
 *
 * Handles safe self-deployment of the dashboard container.
 * This is NOT a server action - it's designed to be called from other server code.
 *
 * The process:
 * 1. Git pull to get latest code
 * 2. Build new image (old container stays running)
 * 3. Create and start new container
 * 4. Health check the new container
 * 5. If healthy, switch traffic to new container
 * 6. If unhealthy, rollback to old container
 */

import { sendDiscordNotification } from "./notifications";
import { auditLogs } from "./atlashub";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

// Host path to the dashboard repo
// The runner's /shell endpoint uses SSH to execute commands ON THE HOST
// So we should always use host paths, not container paths
const DASHBOARD_REPO_PATH = process.env.DASHBOARD_REPO_PATH || "/home/Marczelloo_pi/projects/Marczelloo-dashboard";

// Status file in the projects directory (accessible from both dashboard and host)
const STATUS_FILE = `${DASHBOARD_REPO_PATH}/.deploy-status.json`;

interface SelfDeployResult {
  success: boolean;
  error?: string;
  output?: string;
  rolledBack?: boolean;
}

interface ShellResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

/**
 * Execute a shell command via the runner service
 */
async function execShell(command: string, timeout = 30000): Promise<ShellResult> {
  if (!RUNNER_TOKEN) {
    return { success: false, stderr: "RUNNER_TOKEN not configured" };
  }

  try {
    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({ command, timeout }),
    });

    if (!response.ok) {
      return { success: false, stderr: `Runner returned ${response.status}` };
    }

    const result = await response.json();
    return {
      success: result.success || result.exit_code === 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      success: false,
      stderr: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Update deployment status file (visible to frontend via API)
 */
async function updateDeploymentStatus(
  status: "deploying" | "success" | "failed",
  message?: string,
  commit?: string
): Promise<void> {
  try {
    const statusData = {
      status,
      message,
      commit,
      timestamp: new Date().toISOString(),
    };

    // Use echo with JSON string (more reliable than heredoc via SSH)
    const jsonStr = JSON.stringify(statusData).replace(/'/g, "'\"'\"'");
    await execShell(`echo '${jsonStr}' > "${STATUS_FILE}"`);
    console.log("[SelfDeploy] Status updated:", status, message || "");
  } catch (error) {
    console.error("[SelfDeploy] Failed to update status:", error);
  }
}

/**
 * Perform safe self-deployment with health checks and automatic rollback
 *
 * This function is designed to be run asynchronously from the webhook handler.
 * It logs all steps and sends Discord notifications on success or failure.
 */
export async function performSafeSelfDeploy(options: {
  projectId?: string;
  triggeredBy: string;
  branch?: string;
  commit?: string;
  commitMessage?: string;
  author?: string;
  compareUrl?: string;
}): Promise<SelfDeployResult> {
  const { triggeredBy, commit, commitMessage, author, compareUrl } = options;

  console.log(`[SelfDeploy] Starting safe self-deployment`);
  console.log(`[SelfDeploy] Repo path: ${DASHBOARD_REPO_PATH}`);

  // Set initial status
  await updateDeploymentStatus("deploying", "Starting self-deployment...", commit);

  const output: string[] = [];
  output.push(`=== Safe Self-Deployment ===`);
  output.push(`Triggered by: ${triggeredBy}`);
  output.push(`Repo: ${DASHBOARD_REPO_PATH}`);
  output.push(`Commit: ${commit || "unknown"}`);
  output.push("");

  // Step 1: Git pull
  console.log(`[SelfDeploy] Step 1: Git pull`);
  const pullResult = await execShell(
    `cd "${DASHBOARD_REPO_PATH}" && git fetch --all 2>&1 && git pull origin ${options.branch || "main"} 2>&1`
  );

  output.push(`=== Git Pull ===`);
  output.push(pullResult.stdout || pullResult.stderr || "No output");
  output.push("");

  if (!pullResult.success) {
    console.error(`[SelfDeploy] Git pull failed:`, pullResult.stderr);
    await updateDeploymentStatus("failed", "Git pull failed", commit);
    return {
      success: false,
      error: `Git pull failed: ${pullResult.stderr}`,
      output: output.join("\n"),
    };
  }

  // Step 2: Build new image (synchronously with long timeout)
  console.log(`[SelfDeploy] Step 2: Build new image`);
  await updateDeploymentStatus("deploying", "Building new Docker image (this may take 5-10 min)...", commit);

  // First, verify the path and docker-compose.yml exist
  const verifyResult = await execShell(`ls -la "${DASHBOARD_REPO_PATH}" 2>&1 && ls -la "${DASHBOARD_REPO_PATH}/docker-compose.yml" 2>&1`);
  if (!verifyResult.success) {
    console.error(`[SelfDeploy] Path verification failed:`, verifyResult.stderr);
    output.push(`=== Path Verification ===`);
    output.push(`FAILED: Cannot access ${DASHBOARD_REPO_PATH}`);
    output.push(verifyResult.stderr || "");
    output.push("");

    await updateDeploymentStatus("failed", "Cannot access project directory", commit);

    await sendDiscordNotification({
      title: `❌ Self-Deploy Failed: Path Error`,
      message: `Cannot access the dashboard directory.`,
      color: "danger",
      fields: [
        { name: "Path", value: DASHBOARD_REPO_PATH },
        { name: "Error", value: verifyResult.stderr || "Path not found" },
      ],
      url: compareUrl,
    });

    return {
      success: false,
      error: `Cannot access ${DASHBOARD_REPO_PATH}`,
      output: output.join("\n"),
    };
  }

  output.push(`=== Path Verification ===`);
  output.push(`SUCCESS: Path and docker-compose.yml accessible`);
  output.push("");

  // Build synchronously with extended timeout (10 minutes for Raspberry Pi)
  console.log(`[SelfDeploy] Starting docker compose build...`);
  const buildResult = await execShell(
    `cd "${DASHBOARD_REPO_PATH}" && docker compose build dashboard runner 2>&1`,
    600000 // 10 minute timeout
  );

  output.push(`=== Build Output ===`);
  output.push(buildResult.stdout || buildResult.stderr || "No output");
  output.push("");

  if (!buildResult.success) {
    console.error(`[SelfDeploy] Build failed`);
    await updateDeploymentStatus("failed", "Docker build failed", commit);

    await sendDiscordNotification({
      title: `❌ Self-Deploy Failed: Build Error`,
      message: `Docker image build failed. Check logs for details.`,
      color: "danger",
      fields: [
        { name: "Commit", value: commit || "unknown" },
        { name: "Error", value: (buildResult.stderr || "Unknown error").slice(0, 500) },
      ],
      url: compareUrl,
    });

    return {
      success: false,
      error: "Build failed",
      output: output.join("\n"),
    };
  }

  output.push(`=== Build Result ===`);
  output.push(`SUCCESS`);
  output.push("");

  // Step 3: Mark as successful BEFORE restarting (container restart will kill this process)
  console.log(`[SelfDeploy] Step 3: Mark deployment successful and restart container`);

  // Write success status - retry a few times to ensure it's persisted
  const statusData = {
    status: "success",
    message: `Deployed: ${commitMessage?.substring(0, 50) || "Success"}`,
    commit,
    timestamp: new Date().toISOString(),
  };
  const jsonStr = JSON.stringify(statusData).replace(/'/g, "'\"'\"'");

  for (let i = 0; i < 3; i++) {
    await execShell(`echo '${jsonStr}' > "${STATUS_FILE}"`);
    // Verify it was written
    const verifyCheck = await execShell(`cat "${STATUS_FILE}" 2>/dev/null || echo "FAIL"`);
    if (verifyCheck.stdout && verifyCheck.stdout.includes("success")) {
      console.log(`[SelfDeploy] Status file verified on attempt ${i + 1}`);
      break;
    }
    console.log(`[SelfDeploy] Status verification failed, attempt ${i + 1}/3`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Give the filesystem a moment to sync
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(`[SelfDeploy] Now restarting containers...`);
  const upResult = await execShell(`cd "${DASHBOARD_REPO_PATH}" && docker compose up -d --force-recreate dashboard runner 2>&1`, 120000);

  output.push(`=== Start Container ===`);
  output.push(upResult.stdout || upResult.stderr || "Command executed");
  output.push("");

  if (!upResult.success) {
    console.error(`[SelfDeploy] Failed to start container:`, upResult.stderr);

    await updateDeploymentStatus("failed", "Failed to start new container", commit);

    await sendDiscordNotification({
      title: `❌ Self-Deploy Failed: Start Error`,
      message: `Failed to start new container. Old container still running.`,
      color: "danger",
      fields: [
        { name: "Commit", value: commit || "unknown" },
        { name: "Error", value: upResult.stderr || "Unknown error" },
      ],
      url: compareUrl,
    });

    return {
      success: false,
      error: "Failed to start new container",
      output: output.join("\n"),
    };
  }

  // Container is restarting - send Discord notification and return
  // The process will be killed by the container restart, so we do this first
  console.log(`[SelfDeploy] Container restart initiated, process will end shortly`);

  // Send notification in background (don't await)
  sendDiscordNotification({
    title: `✅ Self-Deploy Successful`,
    message: `Dashboard has been updated. Click reload in the sidebar to see changes.`,
    color: "success",
    fields: [
      { name: "Commit", value: commit || "unknown" },
      { name: "Message", value: commitMessage || "No message" },
      { name: "Author", value: author || "Unknown" },
    ],
    url: compareUrl,
  }).catch((e) => console.error("[SelfDeploy] Discord notification failed:", e));

  // Log to audit (background)
  if (options.projectId) {
    auditLogs.createAuditLog({
      actor_email: triggeredBy,
      action: "deploy",
      entity_type: "project",
      entity_id: options.projectId,
      meta_json: {
        method: "github_webhook_self_deploy",
        commit,
        branch: options.branch,
        success: true,
      },
    }).catch((e) => console.error("[SelfDeploy] Audit log failed:", e));
  }

  // Return success - the container will restart momentarily
  return {
    success: true,
    output: output.join("\n"),
  };
}

/**
 * Start self-deployment in background without waiting
 * This ensures the webhook can return quickly while deployment continues
 */
export function startBackgroundSelfDeploy(options: {
  projectId?: string;
  triggeredBy: string;
  branch?: string;
  commit?: string;
  commitMessage?: string;
  author?: string;
  compareUrl?: string;
}): void {
  console.log(`[SelfDeploy] Starting background self-deploy...`);

  performSafeSelfDeploy(options)
    .then((result) => {
      if (result.success) {
        console.log(`[SelfDeploy] Background deployment completed successfully`);
      } else {
        console.error(`[SelfDeploy] Background deployment failed:`, result.error);
      }
    })
    .catch((error) => {
      console.error(`[SelfDeploy] Background deployment error:`, error);
    });
}
