import { NextResponse } from "next/server";
import * as portainer from "@/server/portainer/client";
import { requireAuth } from "@/server/lib/auth";

export async function POST() {
  try {
    await requireAuth();
    const endpoints = await portainer.getEndpoints();
    return NextResponse.json({ success: true, endpoints: endpoints.length });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
