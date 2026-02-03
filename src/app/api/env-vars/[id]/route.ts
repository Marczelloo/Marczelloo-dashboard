/**
 * GET/PATCH/DELETE /api/env-vars/[id]
 *
 * Manage individual environment variables
 */

import { NextRequest, NextResponse } from "next/server";
import { envVars, auditLogs } from "@/server/atlashub";
import { getCurrentUser, requirePinVerification, AuthError } from "@/server/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Reveal decrypted value (requires PIN)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // PIN verification required to reveal secrets
    let user;
    try {
      user = await requirePinVerification();
    } catch (error) {
      if (error instanceof AuthError && error.code === "PIN_REQUIRED") {
        return NextResponse.json(
          { success: false, error: "PIN verification required", requirePin: true },
          { status: 401 }
        );
      }
      throw error;
    }

    const value = await envVars.revealEnvVarValue(id);

    if (value === null) {
      return NextResponse.json({ success: false, error: "Environment variable not found" }, { status: 404 });
    }

    // Audit log
    await auditLogs.createAuditLog({
      actor_email: user?.email || "system",
      action: "reveal_secret",
      entity_type: "env_var",
      entity_id: id,
    });

    return NextResponse.json({
      success: true,
      value,
    });
  } catch (error) {
    console.error("[ENV Vars] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update env var
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const body = await request.json();
    const { key, value, is_secret } = body;

    const updated = await envVars.updateEnvVar(id, {
      key,
      value,
      is_secret,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Environment variable not found" }, { status: 404 });
    }

    // Audit log
    await auditLogs.createAuditLog({
      actor_email: user?.email || "system",
      action: "update",
      entity_type: "env_var",
      entity_id: id,
      meta_json: { key },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        value_masked: updated.is_secret ? "••••••••" : "(hidden)",
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

// DELETE - Delete env var
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    const deleted = await envVars.deleteEnvVar(id);

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Environment variable not found" }, { status: 404 });
    }

    // Audit log
    await auditLogs.createAuditLog({
      actor_email: user?.email || "system",
      action: "delete",
      entity_type: "env_var",
      entity_id: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ENV Vars] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
