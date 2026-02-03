/**
 * GET/POST /api/env-vars
 *
 * Manage environment variables for services
 */

import { NextRequest, NextResponse } from "next/server";
import { envVars, auditLogs } from "@/server/atlashub";
import { getCurrentUser } from "@/server/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");

    if (!serviceId) {
      return NextResponse.json({ success: false, error: "serviceId is required" }, { status: 400 });
    }

    const vars = await envVars.getEnvVarsForDisplay(serviceId);

    return NextResponse.json({
      success: true,
      data: vars,
    });
  } catch (error) {
    console.error("[ENV Vars] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { service_id, key, value, is_secret } = body;

    if (!service_id || !key || value === undefined) {
      return NextResponse.json({ success: false, error: "service_id, key, and value are required" }, { status: 400 });
    }

    const created = await envVars.createEnvVar({
      service_id,
      key,
      value,
      is_secret: is_secret ?? true,
    });

    // Audit log
    await auditLogs.createAuditLog({
      actor_email: user?.email || "system",
      action: "create",
      entity_type: "env_var",
      entity_id: created.id,
      meta_json: { key, service_id },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...created,
        value_masked: is_secret ? "••••••••" : "(hidden)",
      },
    });
  } catch (error) {
    console.error("[ENV Vars] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
