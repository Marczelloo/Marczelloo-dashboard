import { NextResponse } from "next/server";
import { getCurrentUser, isAllowedUser } from "@/server/lib/auth";
import { getHostSummary } from "@/server/host/summary";

export const dynamic = "force-dynamic";

/** The host page polls this while it is open; the aggregate behind it is cached for 5 s. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAllowedUser())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, data: await getHostSummary() });
  } catch (error) {
    console.error("[host] Failed to read the host:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
