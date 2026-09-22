import "server-only";
import { deleteRows } from "@/server/atlashub/client";

export function uptimeRetentionCutoff(now: Date, days: number): string {
  if (!Number.isFinite(days) || days < 1) throw new Error("Retention must be at least 1 day.");
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function pruneUptimeChecks(now = new Date(), days = Number(process.env.UPTIME_RETENTION_DAYS || 30)): Promise<number> {
  const result = await deleteRows("uptime_checks", [{ operator: "lt", column: "checked_at", value: uptimeRetentionCutoff(now, days) }]);
  return result.deletedCount;
}
