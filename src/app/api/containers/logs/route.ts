import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpointId, containerId, tail = 1000 } = body;

    console.log(`[Logs API] Request: endpointId=${endpointId}, containerId=${containerId}, tail=${tail}`);

    if (!endpointId || !containerId) {
      return NextResponse.json({ error: "Missing required parameters: endpointId and containerId" }, { status: 400 });
    }

    // Validate endpointId is a number
    const endpointNum = parseInt(String(endpointId), 10);
    if (isNaN(endpointNum)) {
      return NextResponse.json({ error: "endpointId must be a number" }, { status: 400 });
    }

    // Import portainer dynamically to catch module errors
    let portainer;
    try {
      portainer = await import("@/server/portainer/client");
    } catch (importError) {
      console.error("[Logs API] Failed to import portainer client:", importError);
      return NextResponse.json({ error: "Portainer client initialization failed" }, { status: 500 });
    }

    console.log(`[Logs API] Fetching logs for container ${containerId} on endpoint ${endpointNum}`);

    let result;
    try {
      result = await portainer.getContainerLogs(endpointNum, containerId, tail);
    } catch (portainerError) {
      console.error("[Logs API] Portainer error:", portainerError);
      const errorMessage = portainerError instanceof Error ? portainerError.message : "Portainer request failed";

      if (errorMessage.includes("404")) {
        return NextResponse.json({ error: "Container not found" }, { status: 404 });
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
