import "server-only";

import type { AppConfigRowInput, AppRouteRowInput, EnvVersionPayload } from "@/server/apps/import/persist-rows";
import type { EnvFileVersionPayload } from "@/server/env/file-versions";
import { decrypt, encrypt } from "@/server/lib/encryption";
import * as db from "./client";

interface AppConfigRow extends AppConfigRowInput {
  id: string;
  created_at: string;
}

export async function upsertAppConfig(row: AppConfigRowInput): Promise<{ id: string; created: boolean }> {
  const existing = await db.select<AppConfigRow>("app_configs", { filters: [{ operator: "eq", column: "project_id", value: row.project_id }], limit: 1 });
  if (existing.data[0]) {
    await db.updateById<AppConfigRow>("app_configs", existing.data[0].id, row);
    return { id: existing.data[0].id, created: false };
  }
  const inserted = await db.insert<AppConfigRow>("app_configs", row);
  return { id: inserted.data[0].id, created: true };
}

export async function getLatestEnvVersion(projectId: string): Promise<{ version: number; fingerprint: string } | null> {
  const response = await db.select<{ version: number; fingerprint: string }>("app_env_versions", {
    select: ["version", "fingerprint"],
    filters: [{ operator: "eq", column: "project_id", value: projectId }],
    order: { column: "version", direction: "desc" },
    limit: 1,
  });
  return response.data[0] ?? null;
}

export async function insertEnvVersion(input: { projectId: string; version: number; keys: unknown; payload: EnvVersionPayload | EnvFileVersionPayload; fingerprint: string; note: string; createdBy: string }): Promise<void> {
  await db.insert("app_env_versions", {
    project_id: input.projectId,
    version: input.version,
    keys: input.keys,
    payload_encrypted: await encrypt(JSON.stringify(input.payload)),
    fingerprint: input.fingerprint,
    note: input.note,
    created_by: input.createdBy,
  });
}

export interface EnvVersionRow {
  version: number;
  keys: unknown;
  fingerprint: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

/** Metadata only, newest first; values stay encrypted. */
export async function listEnvVersions(projectId: string, limit = 100): Promise<EnvVersionRow[]> {
  const response = await db.select<EnvVersionRow>("app_env_versions", {
    select: ["version", "keys", "fingerprint", "note", "created_by", "created_at"],
    filters: [{ operator: "eq", column: "project_id", value: projectId }],
    order: { column: "version", direction: "desc" },
    limit,
  });
  return response.data;
}

export async function getEnvVersionPayload(projectId: string, version: number): Promise<EnvVersionPayload | EnvFileVersionPayload | null> {
  const response = await db.select<{ payload_encrypted: string }>("app_env_versions", {
    select: ["payload_encrypted"],
    filters: [
      { operator: "eq", column: "project_id", value: projectId },
      { operator: "eq", column: "version", value: version },
    ],
    limit: 1,
  });
  const row = response.data[0];
  return row ? (JSON.parse(await decrypt(row.payload_encrypted)) as EnvVersionPayload | EnvFileVersionPayload) : null;
}

export async function replaceImportedRoutes(rows: AppRouteRowInput[]): Promise<number> {
  await db.deleteRows("app_routes", [{ operator: "eq", column: "source", value: "imported" }]);
  if (!rows.length) return 0;
  const inserted = await db.insert("app_routes", rows);
  return inserted.data.length;
}

export async function insertSnapshot(input: { projectId: string | null; kind: string; payload: unknown }): Promise<void> {
  await db.insert("app_snapshots", {
    project_id: input.projectId,
    kind: input.kind,
    payload_encrypted: await encrypt(JSON.stringify(input.payload)),
  });
}

export async function listAppConfigs(): Promise<Array<{ project_id: string; compose_project: string; state: string; updated_at: string }>> {
  const response = await db.select<{ project_id: string; compose_project: string; state: string; updated_at: string }>("app_configs", {
    select: ["project_id", "compose_project", "state", "updated_at"],
    order: { column: "compose_project", direction: "asc" },
    limit: 200,
  });
  return response.data;
}
