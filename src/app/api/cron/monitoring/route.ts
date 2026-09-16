/**
 * External trigger for a monitoring cycle (the built-in scheduler already runs
 * one every minute). Requires `Authorization: Bearer $CRON_SECRET`.
 */

import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { runMonitoring } from "@/server/monitoring";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (isDemoMode()) return NextResponse.json({ success: true, checked: 0, transitions: 0, errors: [] });
    const result = await runMonitoring();
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Monitoring cron error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
