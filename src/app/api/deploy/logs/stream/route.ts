import { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/server/lib/auth";
import { shellQuote } from "@/server/runner/safe-paths";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;
const LOG_FILE_PATTERN = /^\/tmp\/(?:deploy|safe-deploy|self)-[A-Za-z0-9_.-]+\.log$/;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    return new Response("Unauthorized", { status: 401 });
  }

  const logFile = request.nextUrl.searchParams.get("logFile");
  if (!logFile) return new Response("logFile parameter required", { status: 400 });
  if (!LOG_FILE_PATTERN.test(logFile)) return new Response("Invalid log file path", { status: 400 });
  if (!RUNNER_TOKEN) return new Response("Runner not configured", { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastOffset = 0;
      let retries = 0;
      let isClosed = false;
      let isComplete = false;
      let success = false;
      const maxRetries = 600;

      const sendEvent = (event: string, data: unknown): boolean => {
        if (isClosed) return false;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch {
          isClosed = true;
          return false;
        }
      };

      const runner = async (command: string) => {
        const response = await fetch(`${RUNNER_URL}/shell`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RUNNER_TOKEN}`,
          },
          body: JSON.stringify({ command }),
          signal: request.signal,
        });
        return { response, result: await response.json().catch(() => ({})) };
      };

      while (!isComplete && retries < maxRetries && !isClosed) {
        try {
          const marker = await runner(
            `if grep -q 'DEPLOY_COMPLETE\|===[DEPLOY_COMPLETE]===' ${shellQuote(logFile)} 2>/dev/null; then ` +
              `if grep -q 'STATUS: SUCCESS' ${shellQuote(logFile)} 2>/dev/null || grep -q 'DEPLOY_COMPLETE' ${shellQuote(logFile)} 2>/dev/null; then echo SUCCESS; else echo FAILED; fi; ` +
              `elif grep -q 'DEPLOY_FAILED' ${shellQuote(logFile)} 2>/dev/null; then echo FAILED; ` +
              `else echo RUNNING; fi`
          );
          if (marker.response.ok && marker.result.success) {
            const markerText = String(marker.result.stdout || "");
            isComplete = markerText.includes("SUCCESS") || markerText.includes("FAILED");
            success = markerText.includes("SUCCESS");
          }

          const logCommand =
            lastOffset === 0
              ? `cat ${shellQuote(logFile)} 2>/dev/null || true`
              : `tail -c +${lastOffset + 1} ${shellQuote(logFile)} 2>/dev/null || true`;
          const logResult = await runner(logCommand);

          if (logResult.response.ok && logResult.result.success) {
            const newContent = String(logResult.result.stdout || "");
            if (newContent) {
              if (!sendEvent("log", { content: newContent })) break;
              lastOffset += Buffer.byteLength(newContent, "utf8");
            }
          }

          if (!sendEvent("status", { running: !isComplete, offset: lastOffset, success })) break;

          if (!isComplete) {
            retries += 1;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          if (request.signal.aborted) break;
          console.error("[SSE] Error:", error);
          if (!sendEvent("error", { message: "Failed to read deploy logs" })) break;
          retries += 1;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (!isClosed) {
        sendEvent("complete", {
          success,
          totalBytes: lastOffset,
          timedOut: retries >= maxRetries && !isComplete,
        });
        try {
          controller.close();
        } catch {
          // The client may have disconnected between the event and close().
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
