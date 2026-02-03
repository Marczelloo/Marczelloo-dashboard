/**
 * Audit Logs Repository - Action tracking for security
 */

import "server-only";
import * as db from "./client";
import type { AuditLog, CreateAuditLogInput, QueryOptions, AuditAction, EntityType } from "@/types";

const TABLE = "audit_logs";

export async function getAuditLogs(options?: QueryOptions): Promise<AuditLog[]> {
  const response = await db.select<AuditLog>(TABLE, {
    order: { column: "at", direction: "desc" },
    ...options,
  });
  return response.data;
}

export async function getAuditLogsByEntity(entityType: EntityType, entityId: string, limit = 50): Promise<AuditLog[]> {
  const response = await db.select<AuditLog>(TABLE, {
    filters: [
      { operator: "eq", column: "entity_type", value: entityType },
      { operator: "eq", column: "entity_id", value: entityId },
    ],
    order: { column: "at", direction: "desc" },
    limit,
  });
  return response.data;
}

export async function getAuditLogsByActor(actorEmail: string, limit = 50): Promise<AuditLog[]> {
  const response = await db.select<AuditLog>(TABLE, {
    filters: [{ operator: "eq", column: "actor_email", value: actorEmail }],
    order: { column: "at", direction: "desc" },
    limit,
  });
  return response.data;
}

export async function getAuditLogsByAction(action: AuditAction, limit = 50): Promise<AuditLog[]> {
  const response = await db.select<AuditLog>(TABLE, {
    filters: [{ operator: "eq", column: "action", value: action }],
    order: { column: "at", direction: "desc" },
    limit,
  });
  return response.data;
}

export async function getRecentAuditLogs(limit = 100): Promise<AuditLog[]> {
  return getAuditLogs({ limit });
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const response = await db.insert<AuditLog>(TABLE, {
    ...input,
    at: new Date().toISOString(),
  });
  return response.data[0];
}

/**
 * Helper function to log an action - use this throughout the app
 */
export async function logAction(
  actorEmail: string,
  action: AuditAction,
  entityType: EntityType,
  entityId?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await createAuditLog({
      actor_email: actorEmail,
      action,
      entity_type: entityType,
      entity_id: entityId,
      meta_json: meta,
    });
  } catch (error) {
    // Log to console but don't fail the main operation
    console.error("Failed to create audit log:", error);
  }
}

export async function cleanupOldLogs(daysToKeep = 90): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.deleteRows(TABLE, [{ operator: "lt", column: "at", value: cutoff }]);

  return result.deletedCount;
}
