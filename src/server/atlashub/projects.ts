/**
 * Projects Repository - CRUD operations for projects
 */

import "server-only";
import * as db from "./client";
import type { Project, CreateProjectInput, UpdateProjectInput, QueryOptions } from "@/types";

const TABLE = "projects";

export async function getProjects(options?: QueryOptions): Promise<Project[]> {
  const response = await db.select<Project>(TABLE, {
    order: { column: "created_at", direction: "desc" },
    ...options,
  });
  return response.data;
}

export async function getProjectById(id: string): Promise<Project | null> {
  return db.selectById<Project>(TABLE, id);
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const response = await db.select<Project>(TABLE, {
    filters: [{ operator: "eq", column: "slug", value: slug }],
    limit: 1,
  });
  return response.data[0] || null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const now = new Date().toISOString();
  const response = await db.insert<Project>(TABLE, {
    ...input,
    tags: input.tags || [],
    status: input.status || "active",
    created_at: now,
    updated_at: now,
  });
  return response.data[0];
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
  return db.updateById<Project>(TABLE, id, {
    ...input,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteProject(id: string): Promise<boolean> {
  const result = await db.deleteById(TABLE, id);
  return result.deletedCount > 0;
}

export async function getProjectStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  archived: number;
}> {
  const projects = await getProjects({ select: ["status"] });

  return {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    inactive: projects.filter((p) => p.status === "inactive").length,
    archived: projects.filter((p) => p.status === "archived").length,
  };
}
