import { NextRequest, NextResponse } from "next/server";
import { requirePinVerification } from "@/server/lib/auth";
import { dockerExec } from "@/server/runner/client";
import { auditLogs } from "@/server/atlashub";
import { z } from "zod";

const execSchema = z.object({
  containerName: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid container name"),
  command: z.string().min(1).max(1000, "Command too long"),
});

/**
 * POST /api/containers/exec
 * Execute a command inside a Docker container
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePinVerification();

    const body = await request.json();
    const parsed = execSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { containerName, command } = parsed.data;

    // Block dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf?\s+\/[^\/]*/i, // rm -rf /
      /mkfs/i,
      /dd\s+if=/i,
      /:\(\)\{.*\}:/i, // fork bomb
      />(\/dev\/.*)/i, // writing to devices
      /shutdown/i,
      /reboot/i,
      /halt/i,
      /init\s+0/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        await auditLogs.logAction(user.email, "docker_exec_blocked", "container", containerName, {
          command,
          reason: "Dangerous command blocked",
        });

        return NextResponse.json(
          { success: false, error: "This command is not allowed for security reasons" },
          { status: 403 }
        );
      }
    }

    // Execute the command
    const result = await dockerExec(containerName, command);

    // Log the action
    await auditLogs.logAction(user.email, "docker_exec", "container", containerName, {
      command,
      success: result.success,
      output_length: (result.stdout?.length || 0) + (result.stderr?.length || 0),
    });

    return NextResponse.json({
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
    });
  } catch (error) {
    console.error("[API] Docker exec error:", error);

    if (error instanceof Error && error.message.includes("PIN")) {
      return NextResponse.json({ success: false, error: "PIN verification required" }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: "Failed to execute command" }, { status: 500 });
  }
}
