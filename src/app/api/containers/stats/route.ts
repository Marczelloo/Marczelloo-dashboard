import { NextRequest, NextResponse } from "next/server";
import * as portainer from "@/server/portainer/client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoContainerStats } from "@/server/demo/container-logs";
import { requireAuth } from "@/server/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { endpointId, containerId } = body;

    if (!endpointId || !containerId) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
    }

    if (isDemoMode()) {
      return NextResponse.json({ success: true, data: demoContainerStats(String(containerId)) });
    }

    const data = await portainer.getContainerStats(endpointId, containerId);

    if (!data) {
      return NextResponse.json({ success: false, error: "Could not get container stats" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Container stats error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
