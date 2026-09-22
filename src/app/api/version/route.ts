import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { getSelfVersion } from "@/server/agent/self-version";
import { requireAuth } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    if (isDemoMode()) return NextResponse.json({ success: false, error: "No version in the demo." });
    const version = await getSelfVersion();
    if (!version) return NextResponse.json({ success: false, error: "The agent does not know the deployed dashboard version yet." });
    return NextResponse.json({ success: true, version });
  } catch (error) {
    console.error("[Version] Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not read the version." }, { status: 500 });
  }
}
