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
    const { startMonitoringScheduler } = await import("./server/scheduler");
    startMonitoringScheduler();
  }
}
