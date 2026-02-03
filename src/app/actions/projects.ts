"use server";

import { projects, auditLogs, services, workItems, deploys } from "@/server/atlashub";
import { requirePinVerification, getCurrentUser } from "@/server/lib/auth";
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

export async function deployProjectAction(
  id: string,
  customRepoPath?: string
): Promise<ActionResult<{ output: string; detectedPath?: string; deployId?: string }>> {
  try {
    const user = await requirePinVerification();

    if (!RUNNER_TOKEN) {
      return { success: false, error: "Runner not configured (missing RUNNER_TOKEN)" };
    }

    console.log(`[Deploy] Starting deployment for project ${id}, customPath: ${customRepoPath || "(none)"}`);
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
    let output = `=== Deployment Info ===\nProject: ${project.name}\nPath: ${repoPath}\nMode: Background build (to avoid Cloudflare timeout)\n\n`;

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

    // Step 1: Git Pull
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
        command: `cd "${repoPath}" && docker compose config --profiles 2>&1`,
      }),
    });

    if (profilesCheckResponse.ok) {
      const profilesResult = await profilesCheckResponse.json();
      const profiles = (profilesResult.stdout || "").trim().split("\n").filter(Boolean);
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
        command: `cd "${repoPath}" && docker compose ${profileFlags} config --services 2>&1`,
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
    const logFile = `/tmp/deploy-${project.slug}-${Date.now()}.log`;
    const composeCmd = `cd "${repoPath}" && nohup docker compose ${profileFlags} up -d --build > "${logFile}" 2>&1 &`;
    console.log(`[Deploy] Command: ${composeCmd}`);
    console.log(`[Deploy] Log file: ${logFile}`);

    // Create deploy record before starting
    let deployRecord = null;
    if (primaryService) {
      try {
        deployRecord = await deploys.createDeploy({
          service_id: primaryService.id,
          triggered_by: user.email,
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
    await auditLogs.logAction(user.email, "deploy", "project", id, {
      project: project.name,
      repo_path: repoPath,
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
      },
    };
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

    // Check if process is still running
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

    let isComplete = true;
    if (checkResponse.ok) {
      const checkResult = await checkResponse.json();
      isComplete = checkResult.stdout?.includes("COMPLETE") ?? true;
    }

    // Get the log file contents (last 200 lines)
    const logResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `tail -200 "${logFile}" 2>&1 || echo "Log file not found or empty"`,
      }),
    });

    if (!logResponse.ok) {
      return { success: false, error: "Failed to read log file" };
    }

    const logResult = await logResponse.json();
    const log = logResult.stdout || logResult.stderr || "No log output";

    // If complete and we have a deploy ID, update the deploy status
    if (isComplete && deployId) {
      try {
        // Check if there was an error in the output
        const hasError = log.toLowerCase().includes("error") && !log.includes("0 errors");
        await deploys.completeDeploy(deployId, !hasError, {
          error_message: hasError ? "Build completed with errors (check logs)" : undefined,
        });
        revalidatePath("/dashboard");
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
