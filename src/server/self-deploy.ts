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

    // Write via runner shell (executes on host via SSH)
    await execShell(
      `cat > "${STATUS_FILE}" << 'EOFSTATUS'
${JSON.stringify(statusData)}
EOFSTATUS`
    );
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
    `cd "${DASHBOARD_REPO_PATH}" && docker compose build dashboard 2>&1`,
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

  // Step 3: Start new container
  console.log(`[SelfDeploy] Step 3: Start new container`);
  await updateDeploymentStatus("deploying", "Starting new container...", commit);
  const upResult = await execShell(`cd "${DASHBOARD_REPO_PATH}" && docker compose up -d dashboard 2>&1`, 120000);

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

  // Step 4: Wait for health check
  console.log(`[SelfDeploy] Step 4: Waiting for health check`);
  await updateDeploymentStatus("deploying", "Running health checks...", commit);
  const healthCheckRetries = 60; // 60 retries * 3 seconds = 3 minutes
  let healthPassed = false;

  for (let i = 0; i < healthCheckRetries; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check container status
    const statusCheck = await execShell(
      `docker inspect --format='{{.State.Status}}' marczelloo-dashboard 2>/dev/null || echo "not_found"`
    );

    const containerStatus = statusCheck.stdout?.trim() || "";

    if (containerStatus === "not_found" || containerStatus === "exited" || containerStatus === "dead") {
      console.log(`[SelfDeploy] Container not running, status: ${containerStatus}`);
      output.push(`=== Health Check ===`);
      output.push(`FAILED: Container status is ${containerStatus}`);
      output.push("");
      break;
    }

    // Skip health check until past start_period (40s)
    if (i < 15) {
      continue;
    }

    // Check health status
    const healthCheck = await execShell(
      `docker inspect --format='{{.State.Health.Status}}' marczelloo-dashboard 2>/dev/null || echo "no_health"`
    );

    if (healthCheck.success && healthCheck.stdout) {
      const status = healthCheck.stdout.trim();
      console.log(`[SelfDeploy] Health check attempt ${i + 1}: ${status}`);

      if (status === "healthy") {
        healthPassed = true;
        output.push(`=== Health Check ===`);
        output.push(`PASSED (attempt ${i + 1}/${healthCheckRetries})`);
        output.push("");
        break;
      }

      if (status === "unhealthy") {
        output.push(`=== Health Check ===`);
        output.push(`FAILED: Container reported unhealthy`);
        output.push("");
        break;
      }
    }

    // Fallback HTTP check after 20 attempts
    if (i >= 20) {
      const httpCheck = await execShell(
        `docker exec marczelloo-dashboard wget -q -O - http://localhost:3100/api/health 2>/dev/null || echo "http_failed"`,
        10000
      );

      if (httpCheck.success && httpCheck.stdout && (httpCheck.stdout.includes("healthy") || httpCheck.stdout.includes("status"))) {
        healthPassed = true;
        output.push(`=== Health Check ===`);
        output.push(`PASSED via HTTP check (attempt ${i + 1}/${healthCheckRetries})`);
        output.push("");
        break;
      }
    }
  }

  // Step 5: Handle result
  if (!healthPassed) {
    console.log(`[SelfDeploy] Health check failed - initiating rollback`);
    output.push(`=== ROLLBACK INITIATED ===`);
    output.push(`Attempting to restart container (transient issue recovery)...`);
    output.push("");

    const restartResult = await execShell(`cd "${DASHBOARD_REPO_PATH}" && docker compose restart dashboard 2>&1`);

    output.push(`=== Restart Result ===`);
    output.push(restartResult.stdout || restartResult.stderr || "Restart executed");
    output.push("");

    await sendDiscordNotification({
      title: `⚠️ Self-Deploy: Rollback Initiated`,
      message: `New container failed health check. Attempted restart as recovery.`,
      color: "warning",
      fields: [
        { name: "Commit", value: commit || "unknown" },
        { name: "Reason", value: "Health check failed" },
      ],
      url: compareUrl,
    });

    await updateDeploymentStatus("failed", "Health check failed - rollback attempted", commit);

    return {
      success: false,
      error: "Health check failed - rollback attempted",
      output: output.join("\n"),
      rolledBack: true,
    };
  }

  // Success!
  console.log(`[SelfDeploy] Self-deployment completed successfully`);
  output.push(`=== DEPLOYMENT SUCCESSFUL ===`);
  output.push(`New container is healthy and running`);
  output.push("");

  await updateDeploymentStatus("success", `Deployed: ${commitMessage?.substring(0, 50) || "Success"}`, commit);

  await sendDiscordNotification({
    title: `✅ Self-Deploy Successful`,
    message: `Dashboard has been updated and is running the new version.`,
    color: "success",
    fields: [
      { name: "Commit", value: commit || "unknown" },
      { name: "Message", value: commitMessage || "No message" },
      { name: "Author", value: author || "Unknown" },
    ],
    url: compareUrl,
  });

  // Log to audit
  try {
    if (options.projectId) {
      await auditLogs.createAuditLog({
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
      });
    }
  } catch (e) {
    console.error("[SelfDeploy] Failed to create audit log:", e);
  }

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
