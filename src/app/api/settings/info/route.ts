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
    discord: process.env.DISCORD_WEBHOOK_URL ? "configured" : "not set",
    agent: process.env.AGENT_TOKEN ? "configured" : "missing",
    cloudflare: process.env.CLOUDFLARE_API_TOKEN ? "configured" : "missing",
    // How the Pi routes traffic; values, not secrets.
    edgeNetwork: process.env.EDGE_NETWORK ?? null,
    tunnelOrigin: process.env.TUNNEL_ORIGIN ?? null,
    dropPorts: process.env.EDGE_DROP_PORTS === "true",
    projectsDir: process.env.PROJECTS_DIR ?? null,
  };

  return NextResponse.json(info);
}
