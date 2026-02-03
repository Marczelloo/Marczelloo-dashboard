/**
 * Deploys Repository - Deployment history tracking
 */

import "server-only";
import * as db from "./client";
import type { Deploy, CreateDeployInput, DeployStatus, QueryOptions } from "@/types";

const TABLE = "deploys";

export async function getDeploys(options?: QueryOptions): Promise<Deploy[]> {
  const response = await db.select<Deploy>(TABLE, {
    order: { column: "started_at", direction: "desc" },
    ...options,
  });
  return response.data;
}

export async function getDeployById(id: string): Promise<Deploy | null> {
  return db.selectById<Deploy>(TABLE, id);
}

export async function getDeploysByServiceId(serviceId: string, limit = 10): Promise<Deploy[]> {
  const response = await db.select<Deploy>(TABLE, {
    filters: [{ operator: "eq", column: "service_id", value: serviceId }],
    order: { column: "started_at", direction: "desc" },
    limit,
  });
  return response.data;
}

export async function getRecentDeploys(limit = 20): Promise<Deploy[]> {
  const response = await db.select<Deploy>(TABLE, {
    order: { column: "started_at", direction: "desc" },
    limit,
  });
  return response.data;
}

export async function createDeploy(input: CreateDeployInput): Promise<Deploy> {
  const response = await db.insert<Deploy>(TABLE, {
    ...input,
    status: "pending",
    started_at: new Date().toISOString(),
  });
  return response.data[0];
}

export async function updateDeployStatus(
  id: string,
  status: DeployStatus,
  options?: {
    commit_sha?: string;
    logs_object_key?: string;
    error_message?: string;
  }
): Promise<Deploy | null> {
  const updates: Partial<Deploy> = {
    status,
    ...options,
  };

  if (status === "success" || status === "failed" || status === "cancelled") {
    updates.finished_at = new Date().toISOString();
  }

  return db.updateById<Deploy>(TABLE, id, updates);
}

export async function startDeploy(id: string): Promise<Deploy | null> {
  return updateDeployStatus(id, "running");
}

export async function completeDeploy(
  id: string,
  success: boolean,
  options?: { commit_sha?: string; logs_object_key?: string; error_message?: string }
): Promise<Deploy | null> {
  return updateDeployStatus(id, success ? "success" : "failed", options);
}

export async function getDeployStats(): Promise<{
  total: number;
  success: number;
  failed: number;
  pending: number;
  running: number;
}> {
  const deploys = await getDeploys({ select: ["status"] });

  return {
    total: deploys.length,
    success: deploys.filter((d) => d.status === "success").length,
    failed: deploys.filter((d) => d.status === "failed").length,
    pending: deploys.filter((d) => d.status === "pending").length,
    running: deploys.filter((d) => d.status === "running").length,
  };
}
