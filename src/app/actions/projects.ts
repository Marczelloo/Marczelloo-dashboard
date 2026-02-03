"use server";

import { projects, auditLogs, services, workItems } from "@/server/atlashub";
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

export async function deployProjectAction(id: string): Promise<ActionResult<{ output: string }>> {
  try {
    const user = await requirePinVerification();

    if (!RUNNER_TOKEN) {
      return { success: false, error: "Runner not configured" };
    }

    // Get project and its services
    const project = await projects.getProjectById(id);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    const projectServices = await services.getServicesByProjectId(id);
    
    // Try to find repo path from services
    let repoPath: string | null = null;
    for (const service of projectServices) {
      if (service.repo_path) {
        // Get parent directory (project root) from service repo path
        repoPath = service.repo_path;
        break;
      }
    }

    // If no repo path from services, try to infer from project name
    if (!repoPath) {
      // Try common paths based on project slug/name
      const projectsDir = process.env.PROJECTS_DIR || "/home/Marczelloo_pi/projects";
      const possiblePaths = [
        `${projectsDir}/${project.slug}`,
        `${projectsDir}/${project.name}`,
        `${projectsDir}/${project.name.replace(/\s+/g, "-")}`,
      ];
      
      // Check which path exists
      for (const path of possiblePaths) {
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
          if (result.stdout?.includes("EXISTS")) {
            repoPath = path;
            break;
          }
        }
      }
    }

    if (!repoPath) {
      return { success: false, error: "Could not find project directory. Set repo_path on a service." };
    }

    console.log(`[Deploy Project] Deploying ${project.name} from ${repoPath}`);

    // Step 1: Git Pull
    const pullResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cd "${repoPath}" && git pull`,
      }),
    });

    if (!pullResponse.ok) {
      const error = await pullResponse.text();
      return { success: false, error: `Git pull failed: ${error}` };
    }

    const pullResult = await pullResponse.json();
    let output = `=== Git Pull ===\n${pullResult.stdout || pullResult.stderr || "No output"}\n\n`;

    // Step 2: Docker Compose Build and Up
    const composeResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cd "${repoPath}" && docker compose up -d --build`,
      }),
    });

    if (!composeResponse.ok) {
      const error = await composeResponse.text();
      output += `=== Docker Compose ===\nFailed: ${error}`;
      return { success: false, error: output };
    }

    const composeResult = await composeResponse.json();
    output += `=== Docker Compose ===\n${composeResult.stdout || composeResult.stderr || "No output"}`;

    // Log the deployment
    await auditLogs.logAction(user.email, "deploy", "project", id, { 
      project: project.name, 
      repo_path: repoPath,
      success: composeResult.success 
    });

    revalidatePath(`/projects/${id}`);
    revalidatePath("/dashboard");

    return { success: true, data: { output } };
  } catch (error) {
    console.error("deployProjectAction error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Deployment failed" };
  }
}
