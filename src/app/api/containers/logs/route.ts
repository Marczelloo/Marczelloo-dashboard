import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { demoContainerLogs } from "@/server/demo/container-logs";
import { requireAuth } from "@/server/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { endpointId, containerId, tail = 1000, timestamps = false } = body;

    console.log(`[Logs API] Request: endpointId=${endpointId}, containerId=${containerId}, tail=${tail}`);

    if (!containerId) {
      return NextResponse.json({ error: "Missing required parameter: containerId" }, { status: 400 });
    }

    if (isDemoMode()) {
      return NextResponse.json({ logs: demoContainerLogs(String(containerId), Number(tail), Boolean(timestamps)), timestamp: new Date().toISOString() });
    }

    // Import portainer dynamically to catch module errors
    let portainer;
    try {
      portainer = await import("@/server/portainer/client");
    } catch (importError) {
      console.error("[Logs API] Failed to import portainer client:", importError);
      return NextResponse.json({ error: "Portainer client initialization failed" }, { status: 500 });
    }

    // Containers read from the agent carry no endpoint; the Pi has one Docker endpoint.
    let endpointNum = endpointId ? parseInt(String(endpointId), 10) : Number.NaN;
    if (endpointId && isNaN(endpointNum)) {
      return NextResponse.json({ error: "endpointId must be a number" }, { status: 400 });
    }
    if (isNaN(endpointNum)) {
      const endpoints = await portainer.getEndpoints().catch(() => []);
      if (!endpoints[0]) return NextResponse.json({ error: "Portainer has no Docker endpoint" }, { status: 503 });
      endpointNum = endpoints[0].Id;
    }

    console.log(`[Logs API] Fetching logs for container ${containerId} on endpoint ${endpointNum}`);

    let result;
    try {
      result = await portainer.getContainerLogs(endpointNum, containerId, tail, Boolean(timestamps));
    } catch (portainerError) {
      console.error("[Logs API] Portainer error:", portainerError);
      const errorMessage = portainerError instanceof Error ? portainerError.message : "Portainer request failed";

      if (errorMessage.includes("404")) {
        return NextResponse.json({ error: `Container ${containerId} no longer exists` }, { status: 404 });
      }
      if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("token")) {
        return NextResponse.json({ error: "Portainer auth failed. Check token in Settings." }, { status: 401 });
      }
      if (errorMessage.includes("PORTAINER_URL") || errorMessage.includes("not set")) {
        return NextResponse.json({ error: "Portainer not configured" }, { status: 500 });
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const logs = result.logs || "No logs available";
    const lineCount = logs.split("\n").length;
    console.log(`[Logs API] Returning ${logs.length} chars, ${lineCount} lines`);

    return NextResponse.json({ logs, timestamp: result.timestamp });
  } catch (error) {
    console.error("[Logs API] Unexpected error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
