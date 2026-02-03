import { NextResponse } from "next/server";
import * as services from "@/server/atlashub/services";
import * as uptimeChecks from "@/server/atlashub/uptime-checks";
import type { Service } from "@/types";

export async function POST() {
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
        const sslDaysLeft: number | null = null; // TODO: Implement SSL check
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

          // Check SSL expiry for HTTPS URLs
          if (url.startsWith("https://")) {
            // Note: In Node.js, we can't easily get SSL info from fetch
            // This would require using node:https module directly
            // For now, we'll leave sslDaysLeft as null
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

        return { serviceId: service.id, ok, latencyMs, statusCode, error };
      })
    );

    const validResults = results.filter((r) => r !== null);
    const upCount = validResults.filter((r) => r?.ok).length;

    return NextResponse.json({
      success: true,
      checked: validResults.length,
      up: upCount,
      down: validResults.length - upCount,
    });
  } catch (error) {
    console.error("Monitoring check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
