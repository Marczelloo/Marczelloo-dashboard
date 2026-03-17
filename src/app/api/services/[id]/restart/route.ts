import { NextRequest, NextResponse } from "next/server";
import { services } from "@/server/data";
import { dockerRestart } from "@/server/runner/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
