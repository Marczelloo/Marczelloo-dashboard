/**
 * Uptime Checks Repository - Website monitoring data
 */

import "server-only";
import * as db from "./client";
import type { UptimeCheck, CreateUptimeCheckInput, QueryOptions } from "@/types";

const TABLE = "uptime_checks";

export async function getUptimeChecks(options?: QueryOptions): Promise<UptimeCheck[]> {
  const response = await db.select<UptimeCheck>(TABLE, {
    order: { column: "checked_at", direction: "desc" },
    ...options,
  });
  return response.data;
}

export async function getUptimeChecksByServiceId(serviceId: string, limit = 100): Promise<UptimeCheck[]> {
  const response = await db.select<UptimeCheck>(TABLE, {
    filters: [{ operator: "eq", column: "service_id", value: serviceId }],
    order: { column: "checked_at", direction: "desc" },
    limit,
  });
  return response.data;
}

export async function getLatestCheckByServiceId(serviceId: string): Promise<UptimeCheck | null> {
  const checks = await getUptimeChecksByServiceId(serviceId, 1);
  return checks[0] || null;
}

export async function createUptimeCheck(input: CreateUptimeCheckInput): Promise<UptimeCheck> {
  const response = await db.insert<UptimeCheck>(TABLE, {
    ...input,
    checked_at: new Date().toISOString(),
  });
  return response.data[0];
}

export async function getUptimeStats(
  serviceId: string,
  hours = 24
): Promise<{
  uptime: number;
  avgLatency: number;
  checks: number;
  lastOk: boolean;
}> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const response = await db.select<UptimeCheck>(TABLE, {
    filters: [
      { operator: "eq", column: "service_id", value: serviceId },
      { operator: "gte", column: "checked_at", value: since },
    ],
    order: { column: "checked_at", direction: "desc" },
  });

  const checks = response.data;

  if (checks.length === 0) {
    return { uptime: 0, avgLatency: 0, checks: 0, lastOk: false };
  }

  const okChecks = checks.filter((c) => c.ok);
  const latencies = checks.filter((c) => c.latency_ms !== null).map((c) => c.latency_ms!);

  return {
    uptime: (okChecks.length / checks.length) * 100,
    avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    checks: checks.length,
    lastOk: checks[0]?.ok ?? false,
  };
}

export async function cleanupOldChecks(daysToKeep = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.deleteRows(TABLE, [{ operator: "lt", column: "checked_at", value: cutoff }]);

  return result.deletedCount;
}
