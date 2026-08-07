import { NextResponse } from "next/server";
import { requireAuth } from "@/server/lib/auth";

export async function POST() {
  try { await requireAuth(); } catch { return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 }); }
  const runnerUrl = process.env.RUNNER_URL || "http://127.0.0.1:8787";
  const runnerToken = process.env.RUNNER_TOKEN;

  if (!runnerToken) {
    return NextResponse.json({
      success: false,
      error: "RUNNER_TOKEN not configured",
    });
  }

  try {
    // Try /health endpoint first (no auth required)
    const response = await fetch(`${runnerUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        version: data.version,
        status: data.status,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `Runner returned ${response.status}`,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
