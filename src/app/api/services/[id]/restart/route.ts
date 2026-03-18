import { NextRequest, NextResponse } from "next/server";
import { services } from "@/server/data";
import { dockerRestart } from "@/server/runner/client";
import { getCurrentUser } from "@/server/lib/auth";

// Container name pattern for detecting self-restart
const DASHBOARD_CONTAINER_PATTERNS = ["marczelloo-dashboard", "dashboard"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const service = await services.getServiceById(id);
    if (!service) {
      return NextResponse.json(
        { success: false, error: "Service not found" },
        { status: 404 }
      );
    }

    if (service.type !== "docker" || !service.container_id) {
      return NextResponse.json(
        { success: false, error: "Service is not a docker container" },
        { status: 400 }
      );
    }

    // Detect self-restart (dashboard restarting itself)
    const isSelfRestart = DASHBOARD_CONTAINER_PATTERNS.some((pattern) =>
      service.container_id?.toLowerCase().includes(pattern) ||
      service.name?.toLowerCase().includes(pattern)
    );

    if (isSelfRestart) {
      console.log("[Restart] Self-restart detected - using fire-and-forget mode");

      // Start restart in background without waiting for response
      // This prevents 502 errors when the container restarts itself
      dockerRestart(service.container_id).catch((error) => {
        console.error("[Restart] Background restart failed:", error);
      });

      // Return immediately with 202 Accepted
      return NextResponse.json({
        success: true,
        message: "Dashboard is restarting...",
        selfRestart: true,
      }, { status: 202 });
    }

    const result = await dockerRestart(service.container_id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to restart container" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Container ${service.container_id} restarted`,
    });
  } catch (error) {
    console.error("[Restart] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
