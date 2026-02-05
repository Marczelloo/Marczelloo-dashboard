import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/lib/auth";

const RUNNER_URL = process.env.RUNNER_URL || "http://localhost:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

/**
 * Server-Sent Events endpoint for streaming deploy logs in realtime
 *
 * Usage: GET /api/deploy/logs/stream?logFile=/tmp/deploy-xxx.log
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const logFile = searchParams.get("logFile");

  if (!logFile) {
    return new Response("logFile parameter required", { status: 400 });
  }

  // Validate log file path
  if (!logFile.startsWith("/tmp/deploy-") || !logFile.endsWith(".log")) {
    return new Response("Invalid log file path", { status: 400 });
  }

  if (!RUNNER_TOKEN) {
    return new Response("Runner not configured", { status: 500 });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastOffset = 0;
      let isComplete = false;
      let retries = 0;
      const maxRetries = 600; // 10 minutes at 1 second intervals (docker builds can take time)
      let isClosed = false;

      // Track if the stream was cancelled by the client
      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return false;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
          return true;
        } catch (error) {
          // Controller was closed externally (client disconnected)
          console.log("[SSE] Controller closed, stopping stream");
          isClosed = true;
          return false;
        }
      };

      while (!isComplete && retries < maxRetries && !isClosed) {
        try {
          // Check if build process is still running
          const checkResponse = await fetch(`${RUNNER_URL}/shell`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RUNNER_TOKEN}`,
            },
            body: JSON.stringify({
              command: `pgrep -f "docker compose.*up.*build" > /dev/null && echo "RUNNING" || echo "COMPLETE"`,
            }),
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            isComplete = checkResult.stdout?.includes("COMPLETE") ?? false;
          }

          // Get log content starting from last offset
          const logCommand =
            lastOffset === 0
              ? `cat "${logFile}" 2>/dev/null || echo ""`
              : `tail -c +${lastOffset + 1} "${logFile}" 2>/dev/null || echo ""`;

          const logResponse = await fetch(`${RUNNER_URL}/shell`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RUNNER_TOKEN}`,
            },
            body: JSON.stringify({ command: logCommand }),
          });

          if (logResponse.ok) {
            const logResult = await logResponse.json();
            const newContent = logResult.stdout || "";

            if (newContent.length > 0) {
              if (!sendEvent("log", { content: newContent })) break;
              lastOffset += newContent.length;
            }
          }

          // Send heartbeat and status
          if (!sendEvent("status", { running: !isComplete, offset: lastOffset })) break;

          if (!isComplete) {
            // Wait 1 second before next check
            await new Promise((resolve) => setTimeout(resolve, 1000));
            retries++;
          }
        } catch (error) {
          console.error("[SSE] Error:", error);
          if (!sendEvent("error", { message: "Failed to read logs" })) break;
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Send completion event (if stream still open)
      if (!isClosed) {
        sendEvent("complete", {
          success: true,
          totalBytes: lastOffset,
          timedOut: retries >= maxRetries,
        });

        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
