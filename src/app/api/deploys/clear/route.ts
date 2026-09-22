import { NextRequest, NextResponse } from "next/server";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { auditLogs, deploys, services } from "@/server/data";
import { AuthError, requirePinVerification } from "@/server/lib/auth";

/**
 * POST /api/deploys/clear  { projectId? }
 * Clear finished deploys, of one project when projectId is given, otherwise of all.
 * Running and queued deploys are preserved.
 */
export async function POST(request: NextRequest) {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return NextResponse.json(demo.result, { status: 403 });

    const user = await requirePinVerification();
    const { projectId } = (await request.json().catch(() => ({}))) as { projectId?: string };
    const serviceIds = projectId ? (await services.getServicesByProjectId(projectId)).map((service) => service.id) : undefined;

    const deleted = serviceIds && serviceIds.length === 0 ? 0 : await deploys.clearCompletedDeploys(serviceIds);

    await auditLogs.logAction(user.email, "clear_deploys", projectId ? "project" : "deploy", projectId, { deleted_count: deleted });

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" }, { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    }
    console.error("[API] Clear deploys error:", error);
    return NextResponse.json({ success: false, error: "Could not clear the history" }, { status: 500 });
  }
}
