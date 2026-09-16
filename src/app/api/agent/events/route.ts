import { NextRequest, NextResponse } from "next/server";
import { agentEventSchema } from "@agent/api";
import { isAgentRequest } from "@/server/agent/auth";
import { handleAgentEvent } from "@/server/agent/handle-event";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAgentRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = agentEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  try {
    await handleAgentEvent(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[agent-events] Event not processed:", error);
    // 503 makes the agent retry, e.g. while AtlasHub is being redeployed.
    return NextResponse.json({ error: "Event not processed" }, { status: 503 });
  }
}
