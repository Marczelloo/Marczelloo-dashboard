/**
 * Services Repository - CRUD operations for services
 */

import "server-only";
import * as db from "./client";
import type { Service, CreateServiceInput, UpdateServiceInput, QueryOptions } from "@/types";

const TABLE = "services";

export async function getServices(options?: QueryOptions): Promise<Service[]> {
  const response = await db.select<Service>(TABLE, {
    order: { column: "created_at", direction: "desc" },
    ...options,
  });
  return response.data;
}

export async function getServiceById(id: string): Promise<Service | null> {
  return db.selectById<Service>(TABLE, id);
}

export async function getServicesByProjectId(projectId: string): Promise<Service[]> {
  const response = await db.select<Service>(TABLE, {
    filters: [{ operator: "eq", column: "project_id", value: projectId }],
    order: { column: "name", direction: "asc" },
  });
  return response.data;
}

export async function getStandaloneServices(): Promise<Service[]> {
  // Get all services and filter for ones without a project_id
  const all = await getServices();
  return all.filter((s) => s.project_id === null || s.project_id === "");
}

export async function getProjectBoundServices(): Promise<Service[]> {
  // Get all services that have a project_id
  const all = await getServices();
  return all.filter((s) => s.project_id !== null && s.project_id !== "");
}

export async function getDockerServices(): Promise<Service[]> {
  const response = await db.select<Service>(TABLE, {
    filters: [{ operator: "eq", column: "type", value: "docker" }],
  });
  return response.data;
}

export async function getMonitorableServices(): Promise<Service[]> {
  const response = await db.select<Service>(TABLE, {
    filters: [{ operator: "neq", column: "url", value: "" }],
  });
  // Filter out services without URLs (AtlasHub doesn't support IS NOT NULL easily)
  return response.data.filter((s) => s.url !== null && s.url !== "");
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  const now = new Date().toISOString();
  const response = await db.insert<Service>(TABLE, {
    ...input,
    deploy_strategy: input.deploy_strategy || "manual",
    created_at: now,
    updated_at: now,
  });
  return response.data[0];
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service | null> {
  return db.updateById<Service>(TABLE, id, {
    ...input,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteService(id: string): Promise<boolean> {
  const result = await db.deleteById(TABLE, id);
  return result.deletedCount > 0;
}

export async function getServiceStats(): Promise<{
  total: number;
  docker: number;
  vercel: number;
  external: number;
}> {
  const services = await getServices({ select: ["type"] });

  return {
    total: services.length,
    docker: services.filter((s) => s.type === "docker").length,
    vercel: services.filter((s) => s.type === "vercel").length,
    external: services.filter((s) => s.type === "external").length,
  };
}
