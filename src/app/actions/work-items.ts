"use server";

import { workItems, auditLogs, projects } from "@/server/atlashub";
import { requirePinVerification, getCurrentUser } from "@/server/lib/auth";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { createIssue, isGitHubConfigured } from "@/server/github";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CreateWorkItemInput, UpdateWorkItemInput, WorkItemType, WorkItemStatus } from "@/types";

// ========================================
// Validation Schemas
// ========================================

const createWorkItemSchema = z.object({
  project_id: z.string().uuid(),
  type: z.enum(["todo", "bug", "change"]),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["open", "in_progress", "done", "blocked"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  labels: z.array(z.string()).optional(),
});

const updateWorkItemSchema = createWorkItemSchema.partial().omit({ project_id: true });

// ========================================
// Actions
// ========================================

export async function createWorkItemAction(input: CreateWorkItemInput) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = createWorkItemSchema.parse(input);

    const item = await workItems.createWorkItem(parsed);

    await auditLogs.logAction(user.email, "create", "work_item", item.id, { type: item.type, title: item.title });

    revalidatePath(`/projects/${parsed.project_id}`);
    revalidatePath("/dashboard");

    return { success: true as const, data: { id: item.id } };
  } catch (error) {
    console.error("createWorkItemAction error:", error);
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.errors[0].message };
    }
    return { success: false as const, error: "Failed to create work item" };
  }
}

export async function updateWorkItemAction(id: string, input: UpdateWorkItemInput) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = updateWorkItemSchema.parse(input);

    const item = await workItems.updateWorkItem(id, parsed);

    if (!item) {
      return { success: false as const, error: "Work item not found" };
    }

    await auditLogs.logAction(user.email, "update", "work_item", id, parsed);

    revalidatePath(`/projects/${item.project_id}`);

    return { success: true as const };
  } catch (error) {
    console.error("updateWorkItemAction error:", error);
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.errors[0].message };
    }
    return { success: false as const, error: "Failed to update work item" };
  }
}

export async function deleteWorkItemAction(id: string) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    const item = await workItems.getWorkItemById(id);
    if (!item) {
      return { success: false as const, error: "Work item not found" };
    }

    const deleted = await workItems.deleteWorkItem(id);

    if (!deleted) {
      return { success: false as const, error: "Failed to delete work item" };
    }

    await auditLogs.logAction(user.email, "delete", "work_item", id);

    revalidatePath(`/projects/${item.project_id}`);

    return { success: true as const };
  } catch (error) {
    console.error("deleteWorkItemAction error:", error);
    return { success: false as const, error: "Failed to delete work item" };
  }
}

export async function getWorkItemsByProjectAction(projectId: string, type?: WorkItemType, status?: WorkItemStatus) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Not authenticated" };
  }

  const data = await workItems.getWorkItemsByProjectId(projectId, type, status);
  return { success: true as const, data };
}

// ========================================
// GitHub Integration
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
 * Map work item type to GitHub labels
 */
function getLabelsForWorkItemType(type: WorkItemType): string[] {
  const labelMap: Record<string, string[]> = {
    bug: ["bug"],
    feature: ["enhancement"],
    todo: ["todo"],
    change: ["change-request"],
  };
  return labelMap[type] || [];
}

/**
 * Map work item priority to GitHub labels
 */
function getPriorityLabel(priority: string): string | null {
  const priorityMap: Record<string, string> = {
    critical: "priority: critical",
    high: "priority: high",
    medium: "priority: medium",
    low: "priority: low",
  };
  return priorityMap[priority] || null;
}

/**
 * Create a GitHub issue from a work item
 */
export async function createGitHubIssueFromWorkItemAction(workItemId: string) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    if (!isGitHubConfigured()) {
      return { success: false as const, error: "GitHub App not configured" };
    }

    // Get the work item
    const workItem = await workItems.getWorkItemById(workItemId);
    if (!workItem) {
      return { success: false as const, error: "Work item not found" };
    }

    // Check if already linked to a GitHub issue
    if (workItem.github_issue_number) {
      return {
        success: false as const,
        error: `Already linked to issue #${workItem.github_issue_number}`,
      };
    }

    // Get the project to find GitHub URL
    const project = await projects.getProjectById(workItem.project_id);
    if (!project) {
      return { success: false as const, error: "Project not found" };
    }

    if (!project.github_url) {
      return { success: false as const, error: "Project has no GitHub URL" };
    }

    const parsed = parseGitHubUrl(project.github_url);
    if (!parsed) {
      return { success: false as const, error: "Invalid GitHub URL" };
    }

    const { owner, repo } = parsed;

    // Prepare labels
    const labels = [...getLabelsForWorkItemType(workItem.type)];

    const priorityLabel = getPriorityLabel(workItem.priority);
    if (priorityLabel) {
      labels.push(priorityLabel);
    }

    // Add any existing work item labels
    if (workItem.labels && Array.isArray(workItem.labels)) {
      labels.push(...workItem.labels);
    }

    // Prepare issue body
    const body = `${workItem.description || ""}

---
*Created from Dashboard work item*
- **Type:** ${workItem.type}
- **Priority:** ${workItem.priority}
- **Status:** ${workItem.status}
- **Work Item ID:** \`${workItem.id}\`
`;

    // Create the GitHub issue
    const issue = await createIssue(owner, repo, workItem.title, body, {
      labels: [...new Set(labels)], // Remove duplicates
    });

    // Update work item with GitHub issue number
    await workItems.updateWorkItem(workItemId, {
      github_issue_number: issue.number,
    });

    // Log the action
    await auditLogs.logAction(user.email, "create", "github_issue", workItemId, {
      work_item_title: workItem.title,
      github_issue_number: issue.number,
      github_issue_url: issue.html_url,
    });

    revalidatePath(`/projects/${workItem.project_id}/work-items/${workItemId}`);

    return {
      success: true as const,
      data: {
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      },
    };
  } catch (error) {
    console.error("createGitHubIssueFromWorkItemAction error:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to create GitHub issue",
    };
  }
}

/**
 * Link a work item to a GitHub PR
 */
export async function linkWorkItemToPRAction(workItemId: string, prNumber: number) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    // Get the work item
    const workItem = await workItems.getWorkItemById(workItemId);
    if (!workItem) {
      return { success: false as const, error: "Work item not found" };
    }

    // Update work item with PR number
    await workItems.updateWorkItem(workItemId, {
      github_pr_number: prNumber,
    });

    // Log the action
    await auditLogs.logAction(user.email, "link", "work_item_pr", workItemId, {
      work_item_title: workItem.title,
      github_pr_number: prNumber,
    });

    revalidatePath(`/projects/${workItem.project_id}/work-items/${workItemId}`);

    return { success: true as const };
  } catch (error) {
    console.error("linkWorkItemToPRAction error:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to link work item to PR",
    };
  }
}

/**
 * Unlink a work item from GitHub issue/PR
 */
export async function unlinkWorkItemAction(workItemId: string, unlinkType: "issue" | "pr" | "both") {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    // Get the work item
    const workItem = await workItems.getWorkItemById(workItemId);
    if (!workItem) {
      return { success: false as const, error: "Work item not found" };
    }

    const updates: { github_issue_number?: null; github_pr_number?: null } = {};

    if (unlinkType === "issue" || unlinkType === "both") {
      updates.github_issue_number = null;
    }
    if (unlinkType === "pr" || unlinkType === "both") {
      updates.github_pr_number = null;
    }

    await workItems.updateWorkItem(workItemId, updates);

    // Log the action
    await auditLogs.logAction(user.email, "unlink", "work_item_github", workItemId, {
      work_item_title: workItem.title,
      unlink_type: unlinkType,
    });

    revalidatePath(`/projects/${workItem.project_id}/work-items/${workItemId}`);

    return { success: true as const };
  } catch (error) {
    console.error("unlinkWorkItemAction error:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to unlink work item",
    };
  }
}
