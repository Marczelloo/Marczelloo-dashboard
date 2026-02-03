import { NextRequest, NextResponse } from "next/server";
import * as portainer from "@/server/portainer/client";
import * as auditLogs from "@/server/atlashub/audit-logs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpointId, containerId, action } = body;

    if (!endpointId || !containerId || !action) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
    }

    if (!["start", "stop", "restart", "recreate"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const result = await portainer.performContainerAction(endpointId, containerId, action);

    // Log the action (container IDs aren't UUIDs, so store in meta instead)
    const userEmail = process.env.DEV_USER_EMAIL || "unknown";
    await auditLogs.logAction(
      userEmail,
      action as "start" | "stop" | "restart",
      "container",
      undefined, // entity_id expects UUID, container IDs aren't valid UUIDs
      { endpointId, containerId, action, success: result.success }
    );

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("Container action error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
