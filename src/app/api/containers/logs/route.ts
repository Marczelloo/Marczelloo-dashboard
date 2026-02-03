import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpointId, containerId, tail = 500 } = body;

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

    // Clean up the logs
    let cleanLogs = "";
    const buffer = result.logs;

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ logs: "No logs available", timestamp: result.timestamp });
    }

    // Docker logs can be multiplexed (first byte indicates stream type: 0=stdin, 1=stdout, 2=stderr)
    // Or they can be plain text if container runs with tty
    const firstByte = buffer.charCodeAt(0);
    
    if ((firstByte === 0 || firstByte === 1 || firstByte === 2) && buffer.length > 8) {
      // Multiplexed stream - parse frame by frame
      // Format: [STREAM_TYPE(1 byte), 0, 0, 0, SIZE(4 bytes big-endian), PAYLOAD]
      let offset = 0;
      const lines: string[] = [];
      
      while (offset < buffer.length) {
        if (offset + 8 > buffer.length) break;
        
        // Read 4-byte size (big-endian) at offset+4
        const size =
          ((buffer.charCodeAt(offset + 4) & 0xff) << 24) +
          ((buffer.charCodeAt(offset + 5) & 0xff) << 16) +
          ((buffer.charCodeAt(offset + 6) & 0xff) << 8) +
          (buffer.charCodeAt(offset + 7) & 0xff);
        
        offset += 8;
        
        if (size > 0 && size < 1000000 && offset + size <= buffer.length) {
          const payload = buffer.slice(offset, offset + size);
          lines.push(payload);
        }
        offset += size;
      }
      
      cleanLogs = lines.join("");
    } else {
      // Plain text logs - just clean up control characters
      cleanLogs = buffer;
    }
    
    // Remove control characters but keep newlines and tabs
    cleanLogs = cleanLogs.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
    
    console.log(`[Logs API] Returning ${cleanLogs.length} chars of logs (${cleanLogs.split('\n').length} lines)`);

    return NextResponse.json({ logs: cleanLogs || "No logs available", timestamp: result.timestamp });
  } catch (error) {
    console.error("[Logs API] Unexpected error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
