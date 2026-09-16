/**
 * Background scheduler, started from instrumentation.ts (skipped in demo mode).
 * Runs monitoring cycles and daily retention.
 */

import "server-only";

let schedulerStarted = false;
let monitoringInterval: NodeJS.Timeout | null = null;
let retentionInterval: NodeJS.Timeout | null = null;

const MONITORING_INTERVAL = Math.max(30_000, parseInt(process.env.MONITORING_INTERVAL_MS || "60000", 10) || 60_000);

async function runMonitoringChecks(): Promise<void> {
  try {
    const { runMonitoring } = await import("./monitoring");
    const result = await runMonitoring();
    if (result.transitions || result.errors.length) {
      console.log(`[Scheduler] Monitoring: ${result.checked} checked, ${result.muted} muted, ${result.transitions} changes, ${result.saved} saved`);
    }
    for (const error of result.errors) console.warn(`[Scheduler] Monitoring: ${error}`);
  } catch (error) {
    console.error("[Scheduler] Monitoring error:", error);
  }
}

async function runRetention(): Promise<void> {
  try {
    const { pruneUptimeChecks } = await import("./monitoring/retention");
    const { pruneIncidents } = await import("./monitoring");
    const [checks, incidents] = await Promise.all([pruneUptimeChecks(), pruneIncidents()]);
    console.log(`[Scheduler] Retention removed ${checks} uptime checks and ${incidents} incidents`);
  } catch (error) {
    console.error("[Scheduler] Retention failed:", error);
  }
}

export function startMonitoringScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log(`[Scheduler] Starting with ${MONITORING_INTERVAL / 1000}s interval`);

  setTimeout(runMonitoringChecks, 15_000);
  monitoringInterval = setInterval(runMonitoringChecks, MONITORING_INTERVAL);
  setTimeout(runRetention, 60_000);
  retentionInterval = setInterval(runRetention, 24 * 60 * 60 * 1000);

  process.on("SIGTERM", stopMonitoringScheduler);
  process.on("SIGINT", stopMonitoringScheduler);
}

export function stopMonitoringScheduler(): void {
  if (monitoringInterval) clearInterval(monitoringInterval);
  if (retentionInterval) clearInterval(retentionInterval);
  monitoringInterval = null;
  retentionInterval = null;
  schedulerStarted = false;
}
