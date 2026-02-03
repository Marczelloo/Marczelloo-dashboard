"use server";

import { workItems, auditLogs } from "@/server/atlashub";
import { requirePinVerification, getCurrentUser } from "@/server/lib/auth";
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
