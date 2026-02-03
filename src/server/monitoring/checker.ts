/**
 * Website Monitoring Service
 *
 * Performs HTTP health checks and SSL certificate validation
 */

import "server-only";
import { uptimeChecks } from "@/server/atlashub";
import type { Service, CreateUptimeCheckInput } from "@/types";

interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  sslDaysLeft: number | null;
  error: string | null;
}

/**
 * Perform a health check on a URL
 */
export async function checkUrl(url: string, healthUrl?: string): Promise<CheckResult> {
  const targetUrl = healthUrl || url;
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Marczelloo-Dashboard-Monitor/1.0",
      },
      cache: "no-store",
    });

    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - startTime);

    // Get SSL days left (only for HTTPS)
    let sslDaysLeft: number | null = null;
    if (targetUrl.startsWith("https://")) {
      sslDaysLeft = await checkSslExpiry(targetUrl);
    }

    const ok = response.status >= 200 && response.status < 400;

    return {
      ok,
      statusCode: response.status,
      latencyMs,
      sslDaysLeft,
      error: ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);

    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "Request timed out";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      ok: false,
      statusCode: null,
      latencyMs,
      sslDaysLeft: null,
      error: errorMessage,
    };
  }
}

/**
 * Check SSL certificate expiry
 * Note: This is a simplified implementation. For accurate SSL checking,
 * you may need to use a Node.js-based approach with TLS sockets.
 */
async function checkSslExpiry(url: string): Promise<number | null> {
  try {
    // Use a TLS check endpoint if available
    // For now, return null as proper SSL checking requires Node.js tls module
    // which doesn't work in Edge runtime

    // Alternative: Call an external service or Runner endpoint for SSL check
    return null;
  } catch {
    return null;
  }
}

/**
 * Run a check for a service and store the result
 */
export async function checkService(service: Service): Promise<void> {
  if (!service.url) {
    return;
  }

  const result = await checkUrl(service.url, service.health_url || undefined);

  const checkInput: CreateUptimeCheckInput = {
    service_id: service.id,
    status_code: result.statusCode || undefined,
    latency_ms: result.latencyMs || undefined,
    ssl_days_left: result.sslDaysLeft || undefined,
    ok: result.ok,
    error: result.error || undefined,
  };

  await uptimeChecks.createUptimeCheck(checkInput);
}

/**
 * Run checks for all monitorable services
 */
export async function runAllChecks(): Promise<{ checked: number; errors: number }> {
  const { services } = await import("@/server/atlashub");
  const monitorableServices = await services.getMonitorableServices();

  let checked = 0;
  let errors = 0;

  for (const service of monitorableServices) {
    try {
      await checkService(service);
      checked++;
    } catch (error) {
      console.error(`Error checking service ${service.id}:`, error);
      errors++;
    }
  }

  return { checked, errors };
}

/**
 * Get uptime summary for a service
 */
export async function getServiceUptimeSummary(serviceId: string): Promise<{
  current: "up" | "down" | "unknown";
  uptime24h: number;
  avgLatency: number;
  lastCheck: string | null;
  sslDaysLeft: number | null;
}> {
  const stats = await uptimeChecks.getUptimeStats(serviceId, 24);
  const latestCheck = await uptimeChecks.getLatestCheckByServiceId(serviceId);

  return {
    current: latestCheck ? (latestCheck.ok ? "up" : "down") : "unknown",
    uptime24h: stats.uptime,
    avgLatency: stats.avgLatency,
    lastCheck: latestCheck?.checked_at || null,
    sslDaysLeft: latestCheck?.ssl_days_left || null,
  };
}
