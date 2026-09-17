import { NextResponse } from "next/server";
import { getCurrentUser, isAllowedUser } from "@/server/lib/auth";
import { getOverview } from "@/server/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAllowedUser())) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: true, data: await getOverview() });
  } catch (error) {
    console.error("[overview] Failed to build overview:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load overview" }, { status: 500 });
  }
}
