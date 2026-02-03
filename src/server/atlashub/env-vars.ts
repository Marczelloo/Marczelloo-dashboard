/**
 * Environment Variables Repository - Encrypted env var management
 */

import "server-only";
import * as db from "./client";
import type { EnvVar, CreateEnvVarInput, UpdateEnvVarInput, QueryOptions } from "@/types";
import { encrypt, decrypt } from "@/server/lib/encryption";

const TABLE = "env_vars";

export async function getEnvVars(options?: QueryOptions): Promise<EnvVar[]> {
  const response = await db.select<EnvVar>(TABLE, {
    order: { column: "key", direction: "asc" },
    ...options,
  });
  return response.data;
}

export async function getEnvVarById(id: string): Promise<EnvVar | null> {
  return db.selectById<EnvVar>(TABLE, id);
}

export async function getEnvVarsByServiceId(serviceId: string): Promise<EnvVar[]> {
  const response = await db.select<EnvVar>(TABLE, {
    filters: [{ operator: "eq", column: "service_id", value: serviceId }],
    order: { column: "key", direction: "asc" },
  });
  return response.data;
}

export async function createEnvVar(input: CreateEnvVarInput): Promise<EnvVar> {
  const encryptedValue = await encrypt(input.value);

  const response = await db.insert<EnvVar>(TABLE, {
    service_id: input.service_id,
    key: input.key,
    value_encrypted: encryptedValue,
    is_secret: input.is_secret ?? true,
    updated_at: new Date().toISOString(),
  });

  return response.data[0];
}

export async function updateEnvVar(id: string, input: UpdateEnvVarInput): Promise<EnvVar | null> {
  const updates: Partial<EnvVar> = {
    updated_at: new Date().toISOString(),
  };

  if (input.key !== undefined) {
    updates.key = input.key;
  }

  if (input.value !== undefined) {
    updates.value_encrypted = await encrypt(input.value);
  }

  if (input.is_secret !== undefined) {
    updates.is_secret = input.is_secret;
  }

  return db.updateById<EnvVar>(TABLE, id, updates);
}

export async function deleteEnvVar(id: string): Promise<boolean> {
  const result = await db.deleteById(TABLE, id);
  return result.deletedCount > 0;
}

export async function deleteEnvVarsByServiceId(serviceId: string): Promise<number> {
  const result = await db.deleteRows(TABLE, [{ operator: "eq", column: "service_id", value: serviceId }]);
  return result.deletedCount;
}

/**
 * Reveal the decrypted value of an env var (requires PIN verification first)
 */
export async function revealEnvVarValue(id: string): Promise<string | null> {
  const envVar = await getEnvVarById(id);
  if (!envVar) {
    return null;
  }

  return decrypt(envVar.value_encrypted);
}

/**
 * Get env vars with masked values (for display)
 */
export async function getEnvVarsForDisplay(
  serviceId: string
): Promise<(Omit<EnvVar, "value_encrypted"> & { value_masked: string })[]> {
  const envVars = await getEnvVarsByServiceId(serviceId);

  return envVars.map((envVar) => {
    const { value_encrypted: _value_encrypted, ...rest } = envVar;
    return {
      ...rest,
      value_masked: envVar.is_secret ? "••••••••" : "(hidden)",
    };
  });
}

/**
 * Bulk import env vars for a service
 */
export async function bulkImportEnvVars(
  serviceId: string,
  envVars: { key: string; value: string; is_secret?: boolean }[]
): Promise<EnvVar[]> {
  const results: EnvVar[] = [];

  for (const env of envVars) {
    const created = await createEnvVar({
      service_id: serviceId,
      key: env.key,
      value: env.value,
      is_secret: env.is_secret ?? true,
    });
    results.push(created);
  }

  return results;
}
