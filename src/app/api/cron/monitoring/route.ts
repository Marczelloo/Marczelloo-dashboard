/**
 * Cron endpoint for automatic monitoring checks
 *
 * Call this endpoint every 5-10 minutes using:
 * - A system cron job on your Raspberry Pi
 * - An external service like cron-job.org or Uptime Robot
 * - Vercel Cron Jobs (if deployed there)
 *
 * Example cron job (every 5 min):
 *   0,5,10,15,20,25,30,35,40,45,50,55 * * * * curl -X POST http://localhost:3000/api/cron/monitoring -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import * as services from "@/server/atlashub/services";
import * as uptimeChecks from "@/server/atlashub/uptime-checks";
import type { Service } from "@/types";

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const monitorableServices = await services.getMonitorableServices();

    if (monitorableServices.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        message: "No services to check",
      });
    }

    const results = await Promise.all(
      monitorableServices.map(async (service: Service) => {
        const url = service.health_url || service.url;
        if (!url) return null;

        const startTime = Date.now();
        let ok = false;
        let statusCode: number | null = null;
        let latencyMs: number | null = null;
        let sslDaysLeft: number | null = null;
        let error: string | null = null;

        try {
          const response = await fetch(url, {
            method: "GET",
            signal: AbortSignal.timeout(10000),
            redirect: "follow",
          });

          latencyMs = Date.now() - startTime;
          statusCode = response.status;
          ok = response.ok;

          // Basic SSL check for HTTPS URLs
          if (url.startsWith("https://")) {
            // Note: Getting actual SSL cert info requires native TLS inspection
            // For now, we mark HTTPS as having SSL but don't track expiry
            sslDaysLeft = null;
          }
        } catch (e) {
          latencyMs = Date.now() - startTime;
          error = e instanceof Error ? e.message : "Unknown error";
          ok = false;
        }

        // Save the check result
        await uptimeChecks.createUptimeCheck({
          service_id: service.id,
          status_code: statusCode ?? undefined,
          latency_ms: latencyMs ?? undefined,
          ssl_days_left: sslDaysLeft ?? undefined,
          ok,
          error: error ?? undefined,
        });

        return { serviceId: service.id, serviceName: service.name, ok, latencyMs, statusCode, error };
      })
    );

    const validResults = results.filter((r) => r !== null);
    const upCount = validResults.filter((r) => r?.ok).length;

    console.log(
      `[Monitoring Cron] Checked ${validResults.length} services: ${upCount} up, ${validResults.length - upCount} down`
    );

    return NextResponse.json({
      success: true,
      checked: validResults.length,
      up: upCount,
      down: validResults.length - upCount,
      results: validResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Monitoring cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for easier testing
export async function GET(request: NextRequest) {
  return POST(request);
}
