import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { getAgentJob } from "@/server/agent/client";
import { AuthError, requireAuth } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

/** Outcome of one agent job, for views that wait on it; the target and its env are left out. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    if (isDemoMode()) return NextResponse.json({ status: "succeeded", step: null, error: null });
    const job = await getAgentJob(id);
    return NextResponse.json({ status: job.status, step: job.step ?? null, error: job.error });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    return NextResponse.json({ error: "The agent did not answer" }, { status: 503 });
  }
}
