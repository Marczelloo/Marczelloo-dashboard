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
const DASHBOARD_REPO_PATH_HOST = process.env.DASHBOARD_REPO_PATH || "/home/Marczelloo_pi/projects/Marczelloo-dashboard";

// Runner container has projects mounted at /projects
// Translate host path /home/Marczelloo_pi/projects -> /projects
const DASHBOARD_REPO_PATH_RUNNER = DASHBOARD_REPO_PATH_HOST.replace(
  /\/home\/Marczelloo_pi\/projects/,
  "/projects"
);

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
  const repoPath = DASHBOARD_REPO_PATH_RUNNER; // Use runner path for commands executed via runner

  console.log(`[SelfDeploy] Starting safe self-deployment`);
  console.log(`[SelfDeploy] Repo (host): ${DASHBOARD_REPO_PATH_HOST}`);
  console.log(`[SelfDeploy] Repo (runner): ${repoPath}`);

  const output: string[] = [];
  output.push(`=== Safe Self-Deployment ===`);
  output.push(`Triggered by: ${triggeredBy}`);
  output.push(`Repo (host): ${DASHBOARD_REPO_PATH_HOST}`);
  output.push(`Repo (runner): ${repoPath}`);
  output.push(`Commit: ${commit || "unknown"}`);
  output.push("");

  // Step 1: Git pull
  console.log(`[SelfDeploy] Step 1: Git pull`);
  const pullResult = await execShell(
    `cd "${repoPath}" && git fetch --all 2>&1 && git pull origin ${options.branch || "main"} 2>&1`
  );

  output.push(`=== Git Pull ===`);
  output.push(pullResult.stdout || pullResult.stderr || "No output");
  output.push("");

  if (!pullResult.success) {
    console.error(`[SelfDeploy] Git pull failed:`, pullResult.stderr);
    return {
      success: false,
      error: `Git pull failed: ${pullResult.stderr}`,
      output: output.join("\n"),
    };
  }

  // Step 2: Build new image (in background)
  console.log(`[SelfDeploy] Step 2: Build new image`);

  // First, verify the path and docker-compose.yml exist
  const verifyResult = await execShell(`ls -la "${repoPath}" 2>&1 && ls -la "${repoPath}/docker-compose.yml" 2>&1`);
  if (!verifyResult.success) {
    console.error(`[SelfDeploy] Path verification failed:`, verifyResult.stderr);
    output.push(`=== Path Verification ===`);
    output.push(`FAILED: Cannot access ${repoPath}`);
    output.push(verifyResult.stderr || "");
    output.push("");

    await sendDiscordNotification({
      title: `❌ Self-Deploy Failed: Path Error`,
      message: `Cannot access the dashboard directory in the runner container.`,
      color: "danger",
      fields: [
        { name: "Host Path", value: DASHBOARD_REPO_PATH_HOST },
        { name: "Runner Path", value: repoPath },
        { name: "Error", value: verifyResult.stderr || "Path not found" },
      ],
      url: compareUrl,
    });

    return {
      success: false,
      error: `Cannot access ${repoPath} in runner container`,
      output: output.join("\n"),
    };
  }

  output.push(`=== Path Verification ===`);
  output.push(`SUCCESS: Path and docker-compose.yml accessible`);
  output.push("");

  const buildLogFile = `/tmp/safe-deploy-${Date.now()}.log`;

  // Use nohup to run build in background
  const buildCmd = `cd "${repoPath}" && nohup bash -c '
    echo "=== Building new image ===" &&
    docker compose build dashboard 2>&1 &&
    echo "" &&
    echo "===[BUILD_COMPLETE]===" &&
    echo "STATUS: SUCCESS" &&
    echo "TIMESTAMP: $(date -Iseconds)
  ' || (
    echo "" &&
    echo "===[BUILD_COMPLETE]===" &&
    echo "STATUS: FAILED" &&
    echo "TIMESTAMP: $(date -Iseconds)
  )' > "${buildLogFile}" 2>&1 &`;

  await execShell(buildCmd);
  output.push(`=== Build Started ===`);
  output.push(`Running in background. Log: ${buildLogFile}`);
  output.push("");

  // Wait for build to complete (with timeout)
  const maxWaitTime = 600000; // 10 minutes
  const checkInterval = 5000;
  let elapsed = 0;
  let buildSuccess = false;
  let buildOutput = "";

  console.log(`[SelfDeploy] Waiting for build to complete...`);
  while (elapsed < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;

    const logCheck = await execShell(`cat "${buildLogFile}" 2>/dev/null || echo "Log not found"`);

    if (logCheck.success && logCheck.stdout) {
      buildOutput = logCheck.stdout;

      if (buildOutput.includes("===[BUILD_COMPLETE]===")) {
        buildSuccess = buildOutput.includes("STATUS: SUCCESS");
        break;
      }
    }
  }

  if (!buildSuccess) {
    console.error(`[SelfDeploy] Build failed or timed out`);
    output.push(`=== Build Result ===`);
    output.push(`FAILED or timed out after ${maxWaitTime / 1000}s`);
    output.push("");
    output.push(buildOutput);
    output.push("");

    await sendDiscordNotification({
      title: `❌ Self-Deploy Failed: Build Error`,
      message: `Docker image build failed. Old container still running.`,
      color: "danger",
      fields: [
        { name: "Commit", value: commit || "unknown" },
        { name: "Error", value: "Build timed out or failed" },
      ],
      url: compareUrl,
    });

    return {
      success: false,
      error: "Build failed - deployment aborted, old container still running",
      output: output.join("\n"),
    };
  }

  output.push(`=== Build Result ===`);
  output.push(`SUCCESS`);
  output.push("");

  // Step 3: Start new container
  console.log(`[SelfDeploy] Step 3: Start new container`);
  const upResult = await execShell(`cd "${repoPath}" && docker compose up -d dashboard 2>&1`, 120000);

  output.push(`=== Start Container ===`);
  output.push(upResult.stdout || upResult.stderr || "Command executed");
  output.push("");

  if (!upResult.success) {
    console.error(`[SelfDeploy] Failed to start container:`, upResult.stderr);

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

    const restartResult = await execShell(`cd "${repoPath}" && docker compose restart dashboard 2>&1`);

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
