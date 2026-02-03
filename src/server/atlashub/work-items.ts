/**
 * Work Items Repository - CRUD for TODOs, bugs, and changes
 */

import "server-only";
import * as db from "./client";
import type {
  WorkItem,
  CreateWorkItemInput,
  UpdateWorkItemInput,
  QueryOptions,
  WorkItemStatus,
  WorkItemType,
} from "@/types";

const TABLE = "work_items";

export async function getWorkItems(options?: QueryOptions): Promise<WorkItem[]> {
  const response = await db.select<WorkItem>(TABLE, {
    order: { column: "created_at", direction: "desc" },
    ...options,
  });
  return response.data;
}

export async function getWorkItemById(id: string): Promise<WorkItem | null> {
  return db.selectById<WorkItem>(TABLE, id);
}

export async function getOpenWorkItems(): Promise<WorkItem[]> {
  const response = await db.select<WorkItem>(TABLE, {
    filters: [{ operator: "in", column: "status", value: ["open", "in_progress", "blocked"] }],
    order: { column: "created_at", direction: "desc" },
  });
  return response.data;
}

export async function getWorkItemsByProjectId(
  projectId: string,
  type?: WorkItemType,
  status?: WorkItemStatus
): Promise<WorkItem[]> {
  const filters: db.QueryFilter[] = [{ operator: "eq", column: "project_id", value: projectId }];

  if (type) {
    filters.push({ operator: "eq", column: "type", value: type });
  }

  if (status) {
    filters.push({ operator: "eq", column: "status", value: status });
  }

  const response = await db.select<WorkItem>(TABLE, {
    filters,
    order: { column: "priority", direction: "desc" },
  });
  return response.data;
}

export async function getOpenWorkItemsByProjectId(projectId: string): Promise<WorkItem[]> {
  const response = await db.select<WorkItem>(TABLE, {
    filters: [
      { operator: "eq", column: "project_id", value: projectId },
      { operator: "in", column: "status", value: ["open", "in_progress", "blocked"] },
    ],
    order: { column: "priority", direction: "desc" },
  });
  return response.data;
}

export async function createWorkItem(input: CreateWorkItemInput): Promise<WorkItem> {
  // Only send fields that aren't handled by database defaults
  const insertData: Record<string, unknown> = {
    project_id: input.project_id,
    type: input.type,
    title: input.title,
  };

  if (input.description) insertData.description = input.description;
  if (input.status) insertData.status = input.status;
  if (input.priority) insertData.priority = input.priority;
  if (input.labels && input.labels.length > 0) insertData.labels = input.labels;

  const response = await db.insert<WorkItem>(TABLE, insertData);
  return response.data[0];
}

export async function updateWorkItem(id: string, input: UpdateWorkItemInput): Promise<WorkItem | null> {
  // Build update object only with defined fields
  const updateData: Record<string, unknown> = {};

  if (input.type !== undefined) updateData.type = input.type;
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.labels !== undefined) updateData.labels = input.labels;

  return db.updateById<WorkItem>(TABLE, id, updateData);
}

export async function deleteWorkItem(id: string): Promise<boolean> {
  const result = await db.deleteById(TABLE, id);
  return result.deletedCount > 0;
}

export async function getWorkItemStats(projectId?: string): Promise<{
  total: number;
  open: number;
  inProgress: number;
  done: number;
  blocked: number;
  byType: { todo: number; bug: number; change: number };
}> {
  const filters = projectId ? [{ operator: "eq" as const, column: "project_id", value: projectId }] : undefined;

  const response = await db.select<WorkItem>(TABLE, {
    select: ["status", "type"],
    filters,
  });

  const items = response.data;

  return {
    total: items.length,
    open: items.filter((i) => i.status === "open").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
    done: items.filter((i) => i.status === "done").length,
    blocked: items.filter((i) => i.status === "blocked").length,
    byType: {
      todo: items.filter((i) => i.type === "todo").length,
      bug: items.filter((i) => i.type === "bug").length,
      change: items.filter((i) => i.type === "change").length,
    },
  };
}
