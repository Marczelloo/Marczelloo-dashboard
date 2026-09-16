import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { requireAuth } from "@/server/lib/auth";
import { runMonitoring } from "@/server/monitoring";

export async function POST() {
  try {
    await requireAuth();
    if (isDemoMode()) return NextResponse.json({ success: true, checked: 0, transitions: 0, errors: [] });
    const result = await runMonitoring();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Monitoring check error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
