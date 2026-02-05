"use server";

import { projects, auditLogs, services, workItems, deploys } from "@/server/atlashub";
import { requirePinVerification, getCurrentUser } from "@/server/lib/auth";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { notifyDeploySuccess, notifyDeployFailed } from "@/server/notifications";
import {
  createRelease,
  generateReleaseNotes,
  isGitHubConfigured,
  getLatestRelease,
  listRepositories,
} from "@/server/github";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CreateProjectInput, UpdateProjectInput } from "@/types";

// ========================================
// Validation Schemas
// ========================================

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  status: z.enum(["active", "inactive", "archived", "maintenance"]).optional(),
  tags: z.array(z.string()).optional(),
  github_url: z.string().url().optional().or(z.literal("")),
  prod_url: z.string().url().optional().or(z.literal("")),
  vercel_url: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(10000).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

// ========================================
// Types
// ========================================

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ========================================
// Actions
// ========================================

export async function createProjectAction(input: CreateProjectInput): Promise<ActionResult<{ id: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = createProjectSchema.parse(input);

    // Check for unique slug
    const existing = await projects.getProjectBySlug(parsed.slug);
    if (existing) {
      return { success: false, error: "A project with this slug already exists" };
    }

    const project = await projects.createProject(parsed);

    await auditLogs.logAction(user.email, "create", "project", project.id, { name: project.name, slug: project.slug });

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return { success: true, data: { id: project.id } };
  } catch (error) {
    console.error("createProjectAction error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Failed to create project" };
  }
}

export async function updateProjectAction(id: string, input: UpdateProjectInput): Promise<ActionResult> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = updateProjectSchema.parse(input);

    // Check if slug is being changed and if it's unique
    if (parsed.slug) {
      const existing = await projects.getProjectBySlug(parsed.slug);
      if (existing && existing.id !== id) {
        return { success: false, error: "A project with this slug already exists" };
      }
    }

    const project = await projects.updateProject(id, parsed);

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await auditLogs.logAction(user.email, "update", "project", id, parsed);

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("updateProjectAction error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Failed to update project" };
  }
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    // Delete related services and work items first
    const projectServices = await services.getServicesByProjectId(id);
    for (const service of projectServices) {
      await services.deleteService(service.id);
    }

    const projectWorkItems = await workItems.getWorkItemsByProjectId(id);
    for (const item of projectWorkItems) {
      await workItems.deleteWorkItem(item.id);
    }

    const deleted = await projects.deleteProject(id);

    if (!deleted) {
      return { success: false, error: "Project not found" };
    }

    await auditLogs.logAction(user.email, "delete", "project", id);

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("deleteProjectAction error:", error);
    return { success: false, error: "Failed to delete project" };
  }
}

// ========================================
// Read Operations (no PIN required)
// ========================================

export async function getProjectsAction() {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Not authenticated" };
  }

  const data = await projects.getProjects();
  return { success: true as const, data };
}

export async function getProjectByIdAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Not authenticated" };
  }

  const data = await projects.getProjectById(id);
  if (!data) {
    return { success: false as const, error: "Project not found" };
  }

  return { success: true as const, data };
}

// ========================================
// Deploy Operations
// ========================================

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

// Helper function to detect deployment errors in logs
function detectDeploymentError(log: string): { hasError: boolean; errorMessage: string | null } {
  const normalizedLog = log.toLowerCase();

  // Docker/build error patterns
  const errorPatterns = [
    { pattern: /error[:\s]+.*build.*failed/i, message: "Build failed" },
    { pattern: /exited with code [1-9]\d*/i, message: "Container exited with error" },
    { pattern: /failed to (build|pull|create|start)/i, message: "Docker operation failed" },
    { pattern: /error during connect/i, message: "Docker connection error" },
    { pattern: /cannot connect to the docker daemon/i, message: "Docker daemon unreachable" },
    { pattern: /no space left on device/i, message: "Disk full" },
    { pattern: /error:\s*enoent/i, message: "File not found" },
    { pattern: /npm err!/i, message: "NPM error" },
    { pattern: /yarn error/i, message: "Yarn error" },
    { pattern: /fatal:/i, message: "Fatal error" },
    { pattern: /error: failed to solve/i, message: "Docker build failed" },
    { pattern: /exec \/.*: no such file or directory/i, message: "Entrypoint not found" },
  ];

  // Success patterns that override errors (e.g., "0 errors" or build success messages)
  const successPatterns = [
    /successfully built/i,
    /successfully tagged/i,
    /container .+ started/i,
    /Creating .+ \.\.\. done/i,
    /0 error/i,
  ];

  for (const { pattern, message } of errorPatterns) {
    if (pattern.test(log)) {
      // Check if it's overridden by success patterns
      const hasSuccessAfterError = successPatterns.some((sp) => sp.test(log));
      if (!hasSuccessAfterError) {
        return { hasError: true, errorMessage: message };
      }
    }
  }

  // Generic error check - but only if no success patterns found
  if (normalizedLog.includes("error") && !normalizedLog.includes("0 error")) {
    const hasSuccess = successPatterns.some((sp) => sp.test(log));
    if (!hasSuccess) {
      return { hasError: true, errorMessage: "Build completed with errors (check logs)" };
    }
  }

  return { hasError: false, errorMessage: null };
}

/**
 * Internal deploy function that does not require PIN verification.
 * ONLY call this from trusted sources (webhook with verified signature, server-side code).
 * For user-initiated deploys, use deployProjectAction which requires PIN.
 */
export async function internalDeployProject(
  id: string,
  triggeredBy: string,
  options?: {
    customRepoPath?: string;
    branch?: string;
  }
): Promise<ActionResult<{ output: string; detectedPath?: string; deployId?: string; branch?: string }>> {
  const customRepoPath = options?.customRepoPath;
  const branch = options?.branch;

  if (!RUNNER_TOKEN) {
    return { success: false, error: "Runner not configured (missing RUNNER_TOKEN)" };
  }

  console.log(
    `[Deploy] Starting deployment for project ${id}, customPath: ${customRepoPath || "(none)"}, branch: ${branch || "(default)"}, triggeredBy: ${triggeredBy}`
  );
  console.log(`[Deploy] Runner URL: ${RUNNER_URL}`);

  // Get project and its services
  const project = await projects.getProjectById(id);
  if (!project) {
    return { success: false, error: "Project not found" };
  }

  // Get project services to link deploy record
  const projectServices = await services.getServicesByProjectId(id);
  const primaryService = projectServices.find((s) => s.type === "docker") || projectServices[0];

  // Use custom path if provided
  let repoPath: string | null = customRepoPath?.trim() || null;
  let detectedPath: string | undefined;

  if (!repoPath) {
    // Try to find repo path from services
    for (const service of projectServices) {
      if (service.repo_path) {
        repoPath = service.repo_path;
        detectedPath = repoPath;
        console.log(`[Deploy] Found repo_path from service: ${repoPath}`);
        break;
      }
    }
  }

  // If no repo path from services, try to infer from project name
  if (!repoPath) {
    const projectsDir = process.env.PROJECTS_DIR || "/home/Marczelloo_pi/projects";
    const possiblePaths = [
      `${projectsDir}/${project.slug}`,
      `${projectsDir}/${project.name}`,
      `${projectsDir}/${project.name.replace(/\s+/g, "-")}`,
    ];

    console.log(`[Deploy] No service repo_path, trying paths:`, possiblePaths);

    // Check which path exists
    for (const path of possiblePaths) {
      try {
        const checkResponse = await fetch(`${RUNNER_URL}/shell`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RUNNER_TOKEN}`,
          },
          body: JSON.stringify({
            command: `test -d "${path}" && echo "EXISTS" || echo "NOT_FOUND"`,
          }),
        });

        if (checkResponse.ok) {
          const result = await checkResponse.json();
          console.log(`[Deploy] Check ${path}: ${result.stdout?.trim()}`);
          if (result.stdout?.includes("EXISTS")) {
            repoPath = path;
            detectedPath = path;
            break;
          }
        } else {
          console.log(`[Deploy] Check ${path} failed: ${checkResponse.status}`);
        }
      } catch (e) {
        console.error(`[Deploy] Error checking path ${path}:`, e);
      }
    }
  }

  if (!repoPath) {
    return {
      success: false,
      error: "Could not find project directory. Please enter the repo path manually.",
    };
  }

  console.log(`[Deploy] Using path: ${repoPath}`);
  let output = `=== Deployment Info ===\nProject: ${project.name}\nPath: ${repoPath}\nMode: Background build (to avoid Cloudflare timeout)\nTriggered by: ${triggeredBy}\n\n`;

  // Step 0: Check for docker-compose.yml
  console.log(`[Deploy] Checking for docker-compose.yml...`);
  try {
    const checkComposeResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `ls -la "${repoPath}" 2>&1 | head -20`,
      }),
    });

    if (checkComposeResponse.ok) {
      const lsResult = await checkComposeResponse.json();
      output += `=== Directory Contents ===\n${lsResult.stdout || lsResult.stderr || "No output"}\n\n`;
      console.log(`[Deploy] Directory listing: ${lsResult.stdout?.substring(0, 200)}`);
    }
  } catch (e) {
    console.error(`[Deploy] Error listing directory:`, e);
  }

  // Check for compose file
  const checkComposeResponse = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({
      command: `test -f "${repoPath}/docker-compose.yml" && echo "FOUND" || (test -f "${repoPath}/docker-compose.yaml" && echo "FOUND" || echo "NOT_FOUND")`,
    }),
  });

  if (checkComposeResponse.ok) {
    const checkResult = await checkComposeResponse.json();
    console.log(`[Deploy] Compose file check: ${checkResult.stdout?.trim()}`);
    if (checkResult.stdout?.includes("NOT_FOUND")) {
      return {
        success: false,
        error: `No docker-compose.yml found in ${repoPath}`,
        data: { output, detectedPath },
      };
    }
  } else {
    const errorText = await checkComposeResponse.text();
    console.error(`[Deploy] Compose check failed: ${checkComposeResponse.status} - ${errorText}`);
    return {
      success: false,
      error: `Runner error checking compose file: ${checkComposeResponse.status}`,
      data: { output, detectedPath },
    };
  }

  // Step 1a: Git Fetch (always fetch to get latest branches)
  console.log(`[Deploy] Running git fetch...`);
  const fetchResponse = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({
      command: `cd "${repoPath}" && git fetch --all 2>&1`,
    }),
  });

  if (fetchResponse.ok) {
    const fetchResult = await fetchResponse.json();
    output += `=== Git Fetch ===\n${fetchResult.stdout || fetchResult.stderr || "No output"}\n\n`;
    console.log(`[Deploy] Git fetch result: ${fetchResult.stdout?.substring(0, 200)}`);
  }

  // Step 1b: Git Checkout (if branch specified)
  if (branch) {
    console.log(`[Deploy] Checking out branch: ${branch}`);
    const checkoutResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cd "${repoPath}" && git checkout ${branch} 2>&1`,
      }),
    });

    if (!checkoutResponse.ok) {
      const error = await checkoutResponse.text();
      console.error(`[Deploy] Git checkout failed: ${error}`);
      return { success: false, error: `Git checkout failed: ${error}` };
    }

    const checkoutResult = await checkoutResponse.json();
    output += `=== Git Checkout (${branch}) ===\n${checkoutResult.stdout || checkoutResult.stderr || "No output"}\n\n`;
    console.log(`[Deploy] Git checkout result: ${checkoutResult.stdout?.substring(0, 200)}`);
  }

  // Step 1c: Git Pull
  console.log(`[Deploy] Running git pull...`);
  const pullResponse = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({
      command: `cd "${repoPath}" && git pull 2>&1`,
    }),
  });

  if (!pullResponse.ok) {
    const error = await pullResponse.text();
    console.error(`[Deploy] Git pull failed: ${error}`);
    return { success: false, error: `Git pull failed: ${error}` };
  }

  const pullResult = await pullResponse.json();
  output += `=== Git Pull ===\n${pullResult.stdout || pullResult.stderr || "No output"}\n\n`;
  console.log(`[Deploy] Git pull result: ${pullResult.stdout?.substring(0, 200)}`);

  // Step 2: Check what services and profiles exist in compose file
  console.log(`[Deploy] Checking compose services and profiles...`);
  let profileFlags = "";

  const profilesCheckResponse = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({
      // Don't use 2>&1 here - we only want stdout (profile names), not stderr (warnings)
      command: `cd "${repoPath}" && docker compose config --profiles 2>/dev/null`,
    }),
  });

  if (profilesCheckResponse.ok) {
    const profilesResult = await profilesCheckResponse.json();
    // Filter out any lines that don't look like valid profile names
    // Valid profile names are simple strings: lowercase letters, numbers, hyphens, underscores
    const validProfilePattern = /^[a-z0-9][a-z0-9_-]*$/i;
    const profiles = (profilesResult.stdout || "")
      .trim()
      .split("\n")
      .filter((line: string) => line.trim() && validProfilePattern.test(line.trim()));
    if (profiles.length > 0) {
      profileFlags = profiles.map((p: string) => `--profile ${p.trim()}`).join(" ");
      output += `=== Profiles ===\n${profiles.join(", ")}\n\n`;
      console.log(`[Deploy] Profiles found: ${profiles.join(", ")}`);
    }
  }

  const servicesCheckResponse = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({
      command: `cd "${repoPath}" && docker compose ${profileFlags} config --services 2>/dev/null`,
    }),
  });

  if (servicesCheckResponse.ok) {
    const servicesResult = await servicesCheckResponse.json();
    output += `=== Available Services ===\n${servicesResult.stdout || servicesResult.stderr || "No services found"}\n\n`;
    console.log(`[Deploy] Services: ${servicesResult.stdout?.trim()}`);
  }

  // Step 3: Docker Compose Build and Up (run in background to avoid Cloudflare timeout)
  console.log(`[Deploy] Running docker compose in background...`);
  // Use nohup to run in background, redirect output to a log file
  // The command writes a completion marker at the end so we can detect when it's done
  const logFile = `/tmp/deploy-${project.slug}-${Date.now()}.log`;
  // Use a subshell that runs docker compose and then writes a completion marker
  const composeCmd = `cd "${repoPath}" && nohup bash -c 'docker compose ${profileFlags} up -d --build 2>&1; EXIT_CODE=$?; echo ""; echo "===[DEPLOY_COMPLETE]===" ; if [ $EXIT_CODE -eq 0 ]; then echo "STATUS: SUCCESS"; else echo "STATUS: FAILED (exit code: $EXIT_CODE)"; fi; echo "TIMESTAMP: $(date -Iseconds)"' > "${logFile}" 2>&1 &`;
  console.log(`[Deploy] Command: ${composeCmd}`);
  console.log(`[Deploy] Log file: ${logFile}`);

  // Create deploy record before starting
  let deployRecord = null;
  if (primaryService) {
    try {
      deployRecord = await deploys.createDeploy({
        service_id: primaryService.id,
        triggered_by: triggeredBy,
        logs_object_key: logFile, // Store log file path for later retrieval
      });
      await deploys.startDeploy(deployRecord.id);
      console.log(`[Deploy] Created deploy record: ${deployRecord.id}`);
    } catch (e) {
      console.error(`[Deploy] Failed to create deploy record:`, e);
    }
  }

  const composeResponse = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({
      command: composeCmd,
    }),
  });

  if (!composeResponse.ok) {
    const error = await composeResponse.text();
    console.error(`[Deploy] Docker compose failed to start: ${error}`);
    output += `=== Docker Compose ===\nFailed to start: ${error}`;

    // Mark deploy as failed
    if (deployRecord) {
      await deploys.completeDeploy(deployRecord.id, false, { error_message: error });
    }

    return { success: false, error: output };
  }

  // We don't wait for the build to complete - it runs in background
  await composeResponse.json(); // consume the response

  output += `=== Docker Compose ===\nBuild started in background.\nLog file: ${logFile}\n\n`;
  output += `The build is running in the background. Check container status in a few minutes.\n`;
  output += `To view build progress, SSH to Pi and run: tail -f ${logFile}\n`;
  console.log(`[Deploy] Docker compose started in background`);

  // Log the deployment
  await auditLogs.logAction(triggeredBy, "deploy", "project", id, {
    project: project.name,
    repo_path: repoPath,
    branch: branch || "default",
    log_file: logFile,
    background: true,
    deploy_id: deployRecord?.id,
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/dashboard");

  return {
    success: true,
    data: {
      output,
      detectedPath,
      deployId: deployRecord?.id,
      branch,
    },
  };
}

export async function deployProjectAction(
  id: string,
  customRepoPath?: string,
  branch?: string
): Promise<ActionResult<{ output: string; detectedPath?: string; deployId?: string; branch?: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    // Call internal deploy function with user email
    return await internalDeployProject(id, user.email, { customRepoPath, branch });
  } catch (error) {
    console.error("deployProjectAction error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Deployment failed" };
  }
}

/**
 * Check the status of a background deployment by reading the log file
 */
export async function checkDeployLogAction(
  logFile: string,
  deployId?: string
): Promise<ActionResult<{ log: string; isComplete: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    if (!RUNNER_TOKEN) {
      return { success: false, error: "Runner not configured" };
    }

    // Validate log file path (must be in /tmp and match our pattern)
    if (!logFile.startsWith("/tmp/deploy-") || !logFile.endsWith(".log")) {
      return { success: false, error: "Invalid log file path" };
    }

    // Get the log file contents (last 300 lines to ensure we capture the completion marker)
    const logResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `tail -300 "${logFile}" 2>&1 || echo "Log file not found or empty"`,
      }),
    });

    if (!logResponse.ok) {
      return { success: false, error: "Failed to read log file" };
    }

    const logResult = await logResponse.json();
    const log = logResult.stdout || logResult.stderr || "No log output";

    // Check for our completion marker in the log
    // The deploy command writes "===[DEPLOY_COMPLETE]===" when docker compose finishes
    const hasCompletionMarker = log.includes("===[DEPLOY_COMPLETE]===");

    // Also check for docker compose success patterns as fallback for older deploys
    const hasDockerSuccess =
      /Container .+ Started/i.test(log) ||
      /Container .+ Running/i.test(log) ||
      /Creating .+ \.\.\. done/i.test(log) ||
      /Started$/m.test(log);

    // Deploy is complete if we have the marker OR if we see docker success patterns
    // and no more output is being written (check if file was modified recently)
    let isComplete = hasCompletionMarker;

    // If no completion marker but has success patterns, check if file stopped updating
    if (!isComplete && hasDockerSuccess) {
      const checkStaleResponse = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({
          // Check if file was modified in the last 30 seconds
          command: `find "${logFile}" -mmin -0.5 2>/dev/null | grep -q . && echo "RECENT" || echo "STALE"`,
        }),
      });

      if (checkStaleResponse.ok) {
        const staleResult = await checkStaleResponse.json();
        // If file is stale (not modified in 30s) and has success patterns, consider complete
        if (staleResult.stdout?.includes("STALE")) {
          isComplete = true;
        }
      }
    }

    // Check for explicit status in the completion marker
    let markerIndicatesSuccess = true;
    if (hasCompletionMarker) {
      markerIndicatesSuccess = log.includes("STATUS: SUCCESS");
    }

    // If complete and we have a deploy ID, update the deploy status and send notifications
    if (isComplete && deployId) {
      try {
        // Use improved error detection combined with marker status
        const { hasError, errorMessage } = detectDeploymentError(log);
        // If marker explicitly says FAILED, that overrides error detection
        const deployFailed = !markerIndicatesSuccess || hasError;
        const finalErrorMessage = !markerIndicatesSuccess ? "Docker compose exited with non-zero code" : errorMessage;

        // Get the deploy record to check if we've already updated it
        const existingDeploy = await deploys.getDeployById(deployId);
        if (existingDeploy && existingDeploy.status === "running") {
          await deploys.completeDeploy(deployId, !deployFailed, {
            error_message: finalErrorMessage || undefined,
          });

          // Get service name for notification
          const service = existingDeploy.service_id ? await services.getServiceById(existingDeploy.service_id) : null;
          const serviceName = service?.name || "Unknown Service";

          // Send notification
          if (deployFailed) {
            await notifyDeployFailed(serviceName, finalErrorMessage || "Unknown error");
          } else {
            await notifyDeploySuccess(serviceName);
          }

          revalidatePath("/dashboard");
        }
      } catch (e) {
        console.error("[Deploy] Failed to update deploy status:", e);
      }
    }

    return { success: true, data: { log, isComplete } };
  } catch (error) {
    console.error("checkDeployLogAction error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to check log" };
  }
}

/**
 * Check and update all stale "running" deploys
 * Call this periodically or when viewing dashboard
 */
export async function refreshRunningDeploysAction(): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    if (!RUNNER_TOKEN) {
      return { success: false, error: "Runner not configured" };
    }

    // Get all running deploys
    const runningDeploys = await deploys.getDeploys({
      filters: [{ operator: "eq", column: "status", value: "running" }],
    });

    if (runningDeploys.length === 0) {
      return { success: true, data: { updated: 0 } };
    }

    // Check if any docker compose build is still running
    const checkResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `pgrep -f "docker compose.*up.*build" > /dev/null && echo "RUNNING" || echo "COMPLETE"`,
      }),
    });

    let anyBuildRunning = false;
    if (checkResponse.ok) {
      const checkResult = await checkResponse.json();
      anyBuildRunning = checkResult.stdout?.includes("RUNNING") ?? false;
    }

    let updated = 0;

    for (const deploy of runningDeploys) {
      // If no build is running, mark as complete
      if (!anyBuildRunning) {
        // Try to check the log file for errors if we have a path
        let hasError = false;
        if (deploy.logs_object_key) {
          try {
            const logResponse = await fetch(`${RUNNER_URL}/shell`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RUNNER_TOKEN}`,
              },
              body: JSON.stringify({
                command: `tail -100 "${deploy.logs_object_key}" 2>/dev/null || echo ""`,
              }),
            });
            if (logResponse.ok) {
              const logResult = await logResponse.json();
              const log = logResult.stdout || "";
              hasError = log.toLowerCase().includes("error") && !log.includes("0 errors");
            }
          } catch {
            // Ignore log read errors
          }
        }

        await deploys.completeDeploy(deploy.id, !hasError, {
          error_message: hasError ? "Build completed with errors" : undefined,
        });
        updated++;
      }
    }

    if (updated > 0) {
      revalidatePath("/dashboard");
    }

    return { success: true, data: { updated } };
  } catch (error) {
    console.error("refreshRunningDeploysAction error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to refresh deploys" };
  }
}

// ========================================
// GitHub Release Operations
// ========================================

/**
 * Parse GitHub URL to extract owner and repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [/github\.com\/([^\/]+)\/([^\/\?#]+)/, /github\.com:([^\/]+)\/([^\/\?#\.]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  }
  return null;
}

/**
 * Generate a semantic version tag for the next release
 */
async function generateNextVersionTag(
  owner: string,
  repo: string,
  type: "patch" | "minor" | "major" = "patch"
): Promise<string> {
  try {
    const latest = await getLatestRelease(owner, repo);
    if (latest?.tag_name) {
      // Parse existing version (v1.2.3 or 1.2.3)
      const match = latest.tag_name.match(/v?(\d+)\.(\d+)\.(\d+)/);
      if (match) {
        let [, major, minor, patch] = match.map(Number);
        switch (type) {
          case "major":
            major++;
            minor = 0;
            patch = 0;
            break;
          case "minor":
            minor++;
            patch = 0;
            break;
          case "patch":
          default:
            patch++;
        }
        return `v${major}.${minor}.${patch}`;
      }
    }
  } catch {
    // No existing releases or error - start at v1.0.0
  }
  return "v1.0.0";
}

/**
 * Create a GitHub release for a project
 */
export async function createReleaseAction(
  projectId: string,
  options: {
    tagName?: string;
    name?: string;
    description?: string;
    autoGenerateNotes?: boolean;
    versionType?: "patch" | "minor" | "major";
    draft?: boolean;
    prerelease?: boolean;
  } = {}
): Promise<ActionResult<{ tagName: string; htmlUrl: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    if (!isGitHubConfigured()) {
      return { success: false, error: "GitHub App not configured" };
    }

    // Get project
    const project = await projects.getProjectById(projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    if (!project.github_url) {
      return { success: false, error: "Project has no GitHub URL" };
    }

    const parsed = parseGitHubUrl(project.github_url);
    if (!parsed) {
      return { success: false, error: "Invalid GitHub URL" };
    }

    const { owner, repo } = parsed;

    // Generate or use provided tag name
    let tagName = options.tagName;
    if (!tagName) {
      tagName = await generateNextVersionTag(owner, repo, options.versionType || "patch");
    }

    // Generate release notes if requested
    let body = options.description || "";
    if (options.autoGenerateNotes && !body) {
      try {
        const latest = await getLatestRelease(owner, repo);
        const notes = await generateReleaseNotes(owner, repo, tagName, latest?.tag_name);
        body = notes.body;
      } catch (e) {
        console.warn("[Release] Failed to generate notes:", e);
        body = `Release ${tagName}`;
      }
    }

    // Create the release
    const release = await createRelease(owner, repo, tagName, {
      name: options.name || tagName,
      body,
      draft: options.draft || false,
      prerelease: options.prerelease || false,
    });

    // Log the action
    await auditLogs.logAction(user.email, "create", "release", projectId, {
      project: project.name,
      tag: tagName,
      draft: options.draft,
      prerelease: options.prerelease,
    });

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      data: {
        tagName: release.tag_name,
        htmlUrl: release.html_url,
      },
    };
  } catch (error) {
    console.error("createReleaseAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create release",
    };
  }
}

/**
 * Create a release after a successful deploy
 * This can be called after confirming deploy succeeded
 */
export async function createDeployReleaseAction(
  projectId: string,
  deployId: string
): Promise<ActionResult<{ tagName: string; htmlUrl: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    // Verify deploy succeeded
    const deploy = await deploys.getDeployById(deployId);
    if (!deploy) {
      return { success: false, error: "Deploy not found" };
    }

    if (deploy.status !== "success") {
      return { success: false, error: "Can only create release for successful deploys" };
    }

    // Get project
    const project = await projects.getProjectById(projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    if (!project.github_url) {
      return { success: false, error: "Project has no GitHub URL" };
    }

    const parsed = parseGitHubUrl(project.github_url);
    if (!parsed) {
      return { success: false, error: "Invalid GitHub URL" };
    }

    const { owner, repo } = parsed;

    // Generate next patch version
    const tagName = await generateNextVersionTag(owner, repo, "patch");

    // Generate release notes based on commits since last release
    let body = "";
    try {
      const latest = await getLatestRelease(owner, repo);
      const notes = await generateReleaseNotes(owner, repo, tagName, latest?.tag_name);
      body = notes.body;
    } catch (e) {
      console.warn("[Release] Failed to generate notes:", e);
      body = `Deployed on ${new Date().toISOString().split("T")[0]}\n\nDeployed by ${user.email}`;
    }

    // Create the release
    const release = await createRelease(owner, repo, tagName, {
      name: tagName,
      body,
      draft: false,
      prerelease: false,
    });

    // Log the action
    await auditLogs.logAction(user.email, "create", "release", projectId, {
      project: project.name,
      tag: tagName,
      deployId,
      autoCreated: true,
    });

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      data: {
        tagName: release.tag_name,
        htmlUrl: release.html_url,
      },
    };
  } catch (error) {
    console.error("createDeployReleaseAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create release",
    };
  }
}

// ========================================
// GitHub Repository Sync
// ========================================

/**
 * Sync GitHub repositories with dashboard projects
 * Creates new projects for repos that don't exist yet
 * Updates existing projects with latest repo info
 */
export async function syncGitHubReposAction(): Promise<
  ActionResult<{
    created: number;
    updated: number;
    skipped: number;
    details: string[];
  }>
> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    if (!isGitHubConfigured()) {
      return { success: false, error: "GitHub App not configured" };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const details: string[] = [];

    // Fetch all accessible repositories (paginated)
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await listRepositories(page, 50);
      const repos = result.data;

      if (repos.length === 0) {
        hasMore = false;
        break;
      }

      for (const repo of repos) {
        try {
          // Check if project already exists with this GitHub URL
          const existingProjects = await projects.getProjects();
          const existingProject = existingProjects.find((p) => p.github_url === repo.html_url);

          if (existingProject) {
            // Update existing project with latest repo info if needed
            const needsUpdate = existingProject.description !== repo.description || existingProject.name !== repo.name;

            if (needsUpdate) {
              await projects.updateProject(existingProject.id, {
                description: repo.description || undefined,
              });
              updated++;
              details.push(`Updated: ${repo.full_name}`);
            } else {
              skipped++;
            }
          } else {
            // Create new project for this repo
            const slug = repo.name
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "");

            // Check if slug already exists
            const existingBySlug = await projects.getProjectBySlug(slug);
            if (existingBySlug) {
              skipped++;
              details.push(`Skipped (slug exists): ${repo.full_name}`);
              continue;
            }

            // Determine technologies from repo topics/language
            const technologies: string[] = [];
            if (repo.language) {
              technologies.push(repo.language);
            }
            if (repo.topics && repo.topics.length > 0) {
              technologies.push(...repo.topics.slice(0, 5));
            }

            await projects.createProject({
              name: repo.name,
              slug,
              description: repo.description || undefined,
              status: repo.archived ? "archived" : "active",
              github_url: repo.html_url,
              tags: repo.topics || [],
              technologies,
            });

            created++;
            details.push(`Created: ${repo.full_name}`);
          }
        } catch (repoError) {
          console.error(`Failed to sync repo ${repo.full_name}:`, repoError);
          details.push(
            `Error: ${repo.full_name} - ${repoError instanceof Error ? repoError.message : "Unknown error"}`
          );
        }
      }

      // Check if there are more pages
      hasMore = result.pagination?.nextPage !== undefined;
      page++;
    }

    // Log the sync action
    await auditLogs.logAction(user.email, "sync", "github_repos", "all", {
      created,
      updated,
      skipped,
    });

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        created,
        updated,
        skipped,
        details,
      },
    };
  } catch (error) {
    console.error("syncGitHubReposAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync GitHub repositories",
    };
  }
}

/**
 * Import a single GitHub repository as a project
 */
export async function importGitHubRepoAction(
  owner: string,
  repo: string
): Promise<ActionResult<{ projectId: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    if (!isGitHubConfigured()) {
      return { success: false, error: "GitHub App not configured" };
    }

    const githubUrl = `https://github.com/${owner}/${repo}`;

    // Check if already exists
    const existingProjects = await projects.getProjects();
    const existingProject = existingProjects.find((p) => p.github_url === githubUrl);

    if (existingProject) {
      return {
        success: false,
        error: `Project already exists: ${existingProject.name}`,
      };
    }

    // Generate slug
    const slug = repo
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if slug already exists
    const existingBySlug = await projects.getProjectBySlug(slug);
    if (existingBySlug) {
      return {
        success: false,
        error: `A project with slug "${slug}" already exists`,
      };
    }

    // Fetch repo info from GitHub
    const response = await fetch(`/api/github/repos/${owner}/${repo}`);
    let repoData: {
      description?: string;
      language?: string;
      topics?: string[];
      archived?: boolean;
    } = {};

    if (response.ok) {
      const result = await response.json();
      repoData = result.data || {};
    }

    // Create the project
    const project = await projects.createProject({
      name: repo,
      slug,
      description: repoData.description || undefined,
      status: repoData.archived ? "archived" : "active",
      github_url: githubUrl,
      tags: repoData.topics || [],
      technologies: repoData.language ? [repoData.language] : [],
    });

    // Log the action
    await auditLogs.logAction(user.email, "import", "github_repo", project.id, {
      owner,
      repo,
      github_url: githubUrl,
    });

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { projectId: project.id },
    };
  } catch (error) {
    console.error("importGitHubRepoAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import repository",
    };
  }
}
