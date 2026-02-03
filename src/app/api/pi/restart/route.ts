import { NextResponse } from "next/server";
import { requirePinVerification } from "@/server/lib/auth";
import { auditLogs } from "@/server/atlashub";

const RUNNER_URL = process.env.RUNNER_URL || "http://localhost:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export async function POST() {
  try {
    // Require PIN verification for this sensitive action
    const user = await requirePinVerification();

    if (!RUNNER_TOKEN) {
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    // Log the restart action
    await auditLogs.logAction(user.email, "update", "service", "pi-host", {
      action: "pi_restart",
      triggered_by: user.email,
    });

    // Execute the restart command via runner
    // Using sudo reboot which requires passwordless sudo for the user
    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: "sudo /sbin/shutdown -r +1 'Dashboard initiated restart'",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Pi Restart] Failed:", error);
      return NextResponse.json({ success: false, error: "Failed to initiate restart" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Pi will restart in 1 minute",
    });
  } catch (error) {
    console.error("[Pi Restart] Error:", error);

    if (error instanceof Error && error.message.includes("PIN")) {
      return NextResponse.json({ success: false, error: "PIN verification required" }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
