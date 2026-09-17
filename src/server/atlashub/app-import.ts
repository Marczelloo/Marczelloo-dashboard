import "server-only";

import type { EnvFileVersionPayload } from "@/server/env/file-versions";
import { decrypt, encrypt } from "@/server/lib/encryption";
import * as db from "./client";

/** Env set captured by the one-time stage 1 import (kept for history; not restorable as a file). */
export interface EnvVersionPayload {
  version: 1;
  entries: Array<{ key: string; value: string; perService: Record<string, string> | null; origin: string; sourcePath: string | null; services: string[]; secret: boolean }>;
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
    keys: JSON.stringify(input.keys),
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
