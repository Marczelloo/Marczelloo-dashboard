import { NextResponse } from "next/server";
import { requireAuth } from "@/server/lib/auth";

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const info = {
    atlashub: process.env.ATLASHUB_API_URL && process.env.ATLASHUB_SECRET_KEY ? "configured" : "missing",
    portainer: process.env.PORTAINER_URL && process.env.PORTAINER_TOKEN ? "configured" : "missing",
    runner: process.env.RUNNER_URL && process.env.RUNNER_TOKEN ? "configured" : "missing",
    discord: process.env.DISCORD_WEBHOOK_URL ? "configured" : "not set",
  };

  return NextResponse.json(info);
}
