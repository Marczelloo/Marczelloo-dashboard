import { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/server/lib/auth";
import { agentLogStream } from "@/server/agent/log-stream";
import { parseAgentLogRef } from "@/server/agent/refs";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    return new Response("Unauthorized", { status: 401 });
  }

  const logFile = request.nextUrl.searchParams.get("logFile");
  if (!logFile) return new Response("logFile parameter required", { status: 400 });
  const agentJobId = parseAgentLogRef(logFile);
  if (agentJobId) return agentLogStream(agentJobId, request.signal);
  return new Response("This deploy's log came from the old deploy system and is no longer available.", { status: 410 });
}
