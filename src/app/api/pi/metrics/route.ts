import { NextResponse } from "next/server";
import { getCurrentUser, isAllowedUser } from "@/server/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import { mockPiMetrics } from "@/lib/mock-data";
import { getAgentHost } from "@/server/agent/client";
import { toPiMetrics } from "@/server/pi/metrics";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAllowedUser())) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (isDemoMode()) {
      return NextResponse.json({ success: true, data: mockPiMetrics });
    }

    return NextResponse.json({ success: true, data: toPiMetrics(await getAgentHost()) });
  } catch (error) {
    console.error("[Pi Metrics] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get metrics" },
      { status: 500 }
    );
  }
}
