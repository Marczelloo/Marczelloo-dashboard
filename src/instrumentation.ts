/**
 * Next.js Instrumentation - Background Tasks
 *
 * This file runs when the Next.js server starts.
 * We use it to start the automatic monitoring scheduler.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run scheduler on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Skip scheduler in demo mode - no real services to monitor
    if (process.env.DEMO_MODE === "true") {
      console.log("[Scheduler] Skipped - Demo mode enabled");
      return;
    }

    const { startMonitoringScheduler } = await import("./server/scheduler");
    startMonitoringScheduler();
  }
}
