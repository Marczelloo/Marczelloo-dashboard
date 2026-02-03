/**
 * Background Scheduler for Marczelloo Dashboard
 *
 * Runs periodic tasks like monitoring checks.
 * Started automatically when the Next.js server boots via instrumentation.ts
 */

import "server-only";

let schedulerStarted = false;
let monitoringInterval: NodeJS.Timeout | null = null;

// Default: 5 minutes (300000ms)
const MONITORING_INTERVAL = parseInt(process.env.MONITORING_INTERVAL_MS || "300000", 10);

/**
 * Run all monitoring checks
 */
async function runMonitoringChecks(): Promise<void> {
  try {
    // Dynamic imports to avoid loading during build
    const { getMonitorableServices } = await import("./atlashub/services");
    const { createUptimeCheck } = await import("./atlashub/uptime-checks");

    const services = await getMonitorableServices();

    if (services.length === 0) {
      console.log("[Scheduler] No services to monitor");
      return;
    }

    let upCount = 0;
    let downCount = 0;

    for (const service of services) {
      const url = service.health_url || service.url;
      if (!url) continue;

      const startTime = Date.now();
      let ok = false;
      let statusCode: number | null = null;
      let latencyMs: number | null = null;
      let error: string | null = null;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeout);
        latencyMs = Date.now() - startTime;
        statusCode = response.status;
        ok = response.ok;
      } catch (e) {
        latencyMs = Date.now() - startTime;
        error = e instanceof Error ? e.message : "Unknown error";
        ok = false;
      }

      await createUptimeCheck({
        service_id: service.id,
        status_code: statusCode ?? undefined,
        latency_ms: latencyMs ?? undefined,
        ok,
        error: error ?? undefined,
      });

      if (ok) upCount++;
      else downCount++;
    }

    console.log(`[Scheduler] Monitoring complete: ${upCount} up, ${downCount} down`);

    // Send Discord notification if any service is down
    if (downCount > 0 && process.env.DISCORD_WEBHOOK_URL) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `⚠️ **Marczelloo Dashboard Alert**: ${downCount} service(s) are down!`,
          }),
        });
      } catch (e) {
        console.error("[Scheduler] Failed to send Discord notification:", e);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Monitoring error:", error);
  }
}

/**
 * Start the monitoring scheduler
 */
export function startMonitoringScheduler(): void {
  if (schedulerStarted) {
    console.log("[Scheduler] Already running");
    return;
  }

  schedulerStarted = true;
  console.log(`[Scheduler] Starting with ${MONITORING_INTERVAL / 1000}s interval`);

  // Run immediately on startup (with a small delay to let the server fully start)
  setTimeout(() => {
    console.log("[Scheduler] Running initial monitoring check...");
    runMonitoringChecks();
  }, 10000); // 10 second delay

  // Then run on interval
  monitoringInterval = setInterval(() => {
    runMonitoringChecks();
  }, MONITORING_INTERVAL);

  // Clean up on process exit
  process.on("SIGTERM", () => {
    stopMonitoringScheduler();
  });

  process.on("SIGINT", () => {
    stopMonitoringScheduler();
  });
}

/**
 * Stop the monitoring scheduler
 */
export function stopMonitoringScheduler(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    schedulerStarted = false;
    console.log("[Scheduler] Stopped");
  }
}
