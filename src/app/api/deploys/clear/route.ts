import { NextResponse } from "next/server";
import { deploys, auditLogs } from "@/server/atlashub";
import { requirePinVerification } from "@/server/lib/auth";

/**
 * POST /api/deploys/clear
 * Clear all completed deployments (not running or pending)
 */
export async function POST() {
  try {
    const user = await requirePinVerification();

    const deleted = await deploys.clearCompletedDeploys();

    await auditLogs.logAction(user.email, "clear_deploys", "deploy", undefined, {
      deleted_count: deleted,
    });

    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error("[API] Clear deploys error:", error);

    if (error instanceof Error && error.message.includes("PIN")) {
      return NextResponse.json({ success: false, error: "PIN verification required" }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: "Failed to clear deployments" }, { status: 500 });
  }
}
