import { NextRequest, NextResponse } from "next/server";
import { services } from "@/server/atlashub";
import { getCurrentUser } from "@/server/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { serviceId } = await params;
    const service = await services.getServiceById(serviceId);

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error("GET /api/services/[serviceId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
