import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/server/lib/auth";
import { getAgentHost } from "@/server/agent/client";

const COMMON_PORTS: Record<number, string> = {
  22: "SSH",
  80: "HTTP",
  443: "HTTPS",
  3000: "Node.js/AtlasHub",
  3100: "Dashboard",
  5432: "PostgreSQL",
  6379: "Redis",
  8080: "HTTP Alt",
  9000: "Portainer/MinIO",
  9201: "Portainer",
};

/** Host ports published by Docker containers (reported by the agent). */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const rangeStart = Math.max(1, Number(request.nextUrl.searchParams.get("start")) || 1);
    const rangeEnd = Math.min(65535, Number(request.nextUrl.searchParams.get("end")) || 65535);

    const host = await getAgentHost();
    const byPort = new Map<number, { port: number; protocol: string; state: string; process: string; pid: null; label: string | null }>();
    for (const binding of host.publishedPorts) {
      if (binding.hostPort < rangeStart || binding.hostPort > rangeEnd) continue;
      const existing = byPort.get(binding.hostPort);
      if (existing) {
        if (!existing.process.split(", ").includes(binding.container)) existing.process += `, ${binding.container}`;
        continue;
      }
      byPort.set(binding.hostPort, { port: binding.hostPort, protocol: binding.protocol.toUpperCase(), state: "LISTENING", process: binding.container, pid: null, label: COMMON_PORTS[binding.hostPort] ?? null });
    }

    return NextResponse.json({
      success: true,
      ports: [...byPort.values()].sort((a, b) => a.port - b.port),
      range: { start: rangeStart, end: rangeEnd },
      platform: "docker (agent)",
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to scan ports" }, { status: 500 });
  }
}
