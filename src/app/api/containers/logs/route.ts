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

    const buffer = result.logs;

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ logs: "No logs available", timestamp: result.timestamp });
    }

    console.log(
      `[Logs API] Raw buffer length: ${buffer.length}, first bytes: ${buffer
        .slice(0, 20)
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(" ")}`
    );

    // Parse Docker multiplexed stream format
    // Each frame: [stream_type: 1 byte][0][0][0][size: 4 bytes big-endian][payload: size bytes]
    // stream_type: 0=stdin, 1=stdout, 2=stderr
    let cleanLogs = "";

    // Try to detect if this is multiplexed format by checking header pattern
    // In multiplexed format, byte 1,2,3 should be 0 (padding)
    const byte0 = buffer.charCodeAt(0);
    const byte1 = buffer.charCodeAt(1);
    const byte2 = buffer.charCodeAt(2);
    const byte3 = buffer.charCodeAt(3);

    const isMultiplexed =
      buffer.length > 8 && (byte0 === 1 || byte0 === 2) && byte1 === 0 && byte2 === 0 && byte3 === 0;

    console.log(`[Logs API] Detected format: ${isMultiplexed ? "multiplexed" : "plain text"}`);

    if (isMultiplexed) {
      // Parse multiplexed stream
      let offset = 0;
      const chunks: string[] = [];

      while (offset + 8 <= buffer.length) {
        // Read header
        const streamType = buffer.charCodeAt(offset);
        // Bytes 1-3 should be 0 (padding)
        // Bytes 4-7 are size (big-endian)
        const size =
          ((buffer.charCodeAt(offset + 4) & 0xff) << 24) |
          ((buffer.charCodeAt(offset + 5) & 0xff) << 16) |
          ((buffer.charCodeAt(offset + 6) & 0xff) << 8) |
          (buffer.charCodeAt(offset + 7) & 0xff);

        offset += 8;

        // Sanity check
        if (size <= 0 || size > 10000000 || offset + size > buffer.length) {
          console.log(`[Logs API] Invalid frame at offset ${offset - 8}: size=${size}`);
          break;
        }

        const payload = buffer.substring(offset, offset + size);
        chunks.push(payload);
        offset += size;
      }

      cleanLogs = chunks.join("");
      console.log(`[Logs API] Parsed ${chunks.length} frames`);
    } else {
      // Plain text - just use as-is
      cleanLogs = buffer;
    }

    // Clean up control characters but keep newlines, tabs, and ANSI color codes
    cleanLogs = cleanLogs.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();

    const lineCount = cleanLogs.split("\n").length;
    console.log(`[Logs API] Returning ${cleanLogs.length} chars, ${lineCount} lines`);

    return NextResponse.json({ logs: cleanLogs || "No logs available", timestamp: result.timestamp });
  } catch (error) {
    console.error("[Logs API] Unexpected error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
