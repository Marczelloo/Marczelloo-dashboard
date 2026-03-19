/**
 * Package Updates Repository - CRUD operations for package update records
 */

import "server-only";
import * as db from "./client";
import type {
  PackageUpdate,
  CreatePackageUpdateInput,
  UpdatePackageUpdateInput,
  QueryOptions,
} from "@/types";

const TABLE = "package_updates";

/**
 * Get package updates for a project
 */
export async function getPackageUpdates(
  projectId: string,
  options?: QueryOptions
): Promise<PackageUpdate[]> {
  const response = await db.select<PackageUpdate>(TABLE, {
    filters: [{ operator: "eq", column: "project_id", value: projectId }],
    order: { column: "created_at", direction: "desc" },
    limit: 20, // Last 20 updates
    ...options,
  });
  return response.data;
}

/**
 * Get a single package update by ID
 */
export async function getPackageUpdateById(id: string): Promise<PackageUpdate | null> {
  return db.selectById<PackageUpdate>(TABLE, id);
}

/**
 * Get the latest successful package update for rollback
 */
export async function getLatestRollbackableUpdate(
  projectId: string,
  ecosystem: string
): Promise<PackageUpdate | null> {
  const response = await db.select<PackageUpdate>(TABLE, {
    filters: [
      { operator: "eq", column: "project_id", value: projectId },
      { operator: "eq", column: "ecosystem", value: ecosystem },
      { operator: "eq", column: "status", value: "success" },
    ],
    order: { column: "created_at", direction: "desc" },
    limit: 1,
  });
  return response.data[0] || null;
}

/**
 * Create a new package update record
 */
export async function createPackageUpdate(
  input: CreatePackageUpdateInput
): Promise<PackageUpdate> {
  const response = await db.insert<PackageUpdate>(TABLE, {
    ...input,
    created_at: new Date().toISOString(),
  });
  return response.data[0];
}

/**
 * Update a package update record
 */
export async function updatePackageUpdate(
  id: string,
  input: UpdatePackageUpdateInput
): Promise<PackageUpdate | null> {
  return db.updateById<PackageUpdate>(TABLE, id, input);
}

/**
 * Mark update as rolled back
 */
export async function markAsRolledBack(
  id: string,
  errorMessage?: string
): Promise<PackageUpdate | null> {
  return updatePackageUpdate(id, {
    status: "rolled_back",
    completed_at: new Date().toISOString(),
    error_message: errorMessage || "Rolled back after failed tests",
  });
}

/**
 * Mark update as successful
 */
export async function markAsSuccess(
  id: string,
  branchName?: string,
  prUrl?: string
): Promise<PackageUpdate | null> {
  return updatePackageUpdate(id, {
    status: "success",
    completed_at: new Date().toISOString(),
    branch_name: branchName,
    pr_url: prUrl,
  });
}

/**
 * Mark update as failed
 */
export async function markAsFailed(
  id: string,
  errorMessage: string,
  testOutput?: string
): Promise<PackageUpdate | null> {
  return updatePackageUpdate(id, {
    status: "failed",
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
    test_output: testOutput,
  });
}
