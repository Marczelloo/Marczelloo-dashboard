import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { agentEventSchema } from "@agent/api";
import { handleAgentEvent } from "@/server/agent/handle-event";

export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const token = process.env.AGENT_TOKEN;
  if (!token) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request.headers.get("authorization"))) {
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
