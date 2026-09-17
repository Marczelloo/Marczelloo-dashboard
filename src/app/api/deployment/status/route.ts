import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { getSelfDeployment } from "@/server/agent/self-version";
import { AuthError, requireAuth } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

/** Whether the agent is deploying the dashboard itself, and which release is live. */
export async function GET() {
  try {
    await requireAuth();
    if (isDemoMode()) return NextResponse.json({ commit: null, activeJob: null });
    return NextResponse.json(await getSelfDeployment());
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    }
    return NextResponse.json({ commit: null, activeJob: null });
  }
}
