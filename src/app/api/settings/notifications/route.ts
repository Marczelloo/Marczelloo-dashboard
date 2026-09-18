import { NextRequest, NextResponse } from "next/server";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { getNotificationPreferences, setNotificationPreferences } from "@/server/notifications/preferences";
import { requireAuth } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({ success: true, data: await getNotificationPreferences() });
  } catch {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
}

/** One switch at a time; the body carries only what changed. */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return NextResponse.json(demo.result, { status: 403 });
    const body = (await request.json()) as Record<string, unknown>;
    const update = Object.fromEntries(Object.entries(body).filter(([, value]) => typeof value === "boolean")) as Record<string, boolean>;
    return NextResponse.json({ success: true, data: await setNotificationPreferences(update) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
