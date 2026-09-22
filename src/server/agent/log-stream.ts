import "server-only";

import { getAgentJob, readAgentJobLogToEnd } from "./client";

const HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export function agentLogStream(jobId: string, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let offset = 0;
      let complete = false;
      let success = false;
      const send = (event: string, data: unknown) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      const deadline = Date.now() + 60 * 60 * 1000;
      while (!closed && !signal.aborted && Date.now() < deadline) {
        try {
          const job = await getAgentJob(jobId);
          complete = job.status !== "queued" && job.status !== "running";
          success = job.status === "succeeded";
          // Read after the status so the final lines of a finished job are included.
          const log = await readAgentJobLogToEnd(jobId, offset);
          if (log.content && !send("log", { content: log.content })) break;
          offset = log.nextOffset;
          if (!send("status", { running: !complete, offset, success, agentStatus: job.status })) break;
          if (complete) break;
        } catch {
          if (!send("error", { message: "Could not read the agent log" })) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!closed) {
        send("complete", { success, totalBytes: offset, timedOut: !complete });
        try {
          controller.close();
        } catch {
          // The client disconnected between the event and close().
        }
      }
    },
  });
  return new Response(stream, { headers: HEADERS });
}
