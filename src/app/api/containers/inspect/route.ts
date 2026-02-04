import { NextRequest, NextResponse } from "next/server";
import * as portainer from "@/server/portainer/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpointId, containerId } = body;

    if (!endpointId || !containerId) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
    }

    const data = await portainer.inspectContainer(endpointId, containerId);

    if (!data) {
      return NextResponse.json({ success: false, error: "Container not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Container inspect error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
