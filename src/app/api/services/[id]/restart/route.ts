import { NextRequest, NextResponse } from "next/server";
import { services } from "@/server/data";
import { restartAgentContainer } from "@/server/agent/client";
import { AuthError, requirePinVerification } from "@/server/lib/auth";

const DASHBOARD_CONTAINER = "marczelloo-dashboard";

/** Restarts a service's Compose container through the agent (no host shell). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePinVerification();
    const { id } = await params;

    const service = await services.getServiceById(id);
    if (!service) return NextResponse.json({ success: false, error: "Service not found." }, { status: 404 });
    if (service.type !== "docker" || !service.container_id) {
      return NextResponse.json({ success: false, error: "The service has no Docker container." }, { status: 400 });
    }

    if (service.container_id === DASHBOARD_CONTAINER) {
      // The response would be cut off by the restart itself, so answer first.
      restartAgentContainer(service.container_id).catch((error) => console.error("[Restart] Dashboard restart failed:", error instanceof Error ? error.message : error));
      return NextResponse.json({ success: true, message: "The dashboard is restarting…", selfRestart: true }, { status: 202 });
    }

    await restartAgentContainer(service.container_id);
    return NextResponse.json({ success: true, message: `Container ${service.container_id} restarted.` });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" },
        { status: error.code === "NOT_AUTHENTICATED" ? 401 : 403 }
      );
    }
    console.error("[Restart] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not restart the container." }, { status: 500 });
  }
}
