import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { runAgentCommand } from "@/server/agent/client";
import * as auditLogs from "@/server/atlashub/audit-logs";
import { AuthError, requirePinVerification } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The host console. The agent decides what may run; this route only carries the
 * line across and insists on the PIN first, because output can be revealing.
 */
export async function POST(request: NextRequest) {
  let actor: string | null = null;
  let line: string | null = null;
  try {
    if (isDemoMode()) {
      return NextResponse.json({ success: false, error: "The console is disabled in demo mode." }, { status: 403 });
    }
    const user = await requirePinVerification();
    const { command } = (await request.json()) as { command?: unknown };
    if (typeof command !== "string" || !command.trim()) {
      return NextResponse.json({ success: false, error: "Type a command first." }, { status: 400 });
    }
    actor = user.email;
    line = command.trim();
    const data = await runAgentCommand(command);
    await auditLogs.logAction(actor, "docker_exec", "container", undefined, { source: "host-console", command: line });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" },
        { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (actor && line) {
      await auditLogs.logAction(actor, "docker_exec_blocked", "container", undefined, { source: "host-console", command: line, error: message });
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
