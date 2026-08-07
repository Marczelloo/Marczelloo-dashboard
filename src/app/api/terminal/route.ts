import { NextResponse } from "next/server";
import { verifyPinAction } from "@/app/actions/auth";
import { AuthError, requireAuth } from "@/server/lib/auth";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { command, cwd, pin } = await request.json();

    if (typeof command !== "string" || command.length === 0 || command.length > 4000 || command.includes("\0")) {
      return NextResponse.json({ error: "command must be a non-empty string up to 4000 characters" }, { status: 400 });
    }

    if (cwd !== undefined && (typeof cwd !== "string" || cwd.length > 300 || cwd.includes("\0"))) {
      return NextResponse.json({ error: "Invalid working directory" }, { status: 400 });
    }

    // Skip PIN check in development if DEV_SKIP_PIN is set
    const skipPin = process.env.DEV_SKIP_PIN === "true";

    if (!skipPin && !user.isPinVerified) {
      if (!pin) {
        return NextResponse.json({ error: "PIN required for terminal access" }, { status: 401 });
      }

      const pinResult = await verifyPinAction(pin);
      if (!pinResult.success) {
        return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
      }
    }

    if (!command) {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }

    if (!RUNNER_TOKEN) {
      return NextResponse.json({ error: "Runner not configured" }, { status: 500 });
    }

    // Forward to runner with default cwd if not provided
    const defaultCwd = process.env.DASHBOARD_REPO_PATH || "/home/Marczelloo_pi/projects/Marczelloo-dashboard";
    const effectiveCwd = cwd || defaultCwd;

    const allowedRoots = [
      defaultCwd,
      process.env.DEFAULT_CWD,
      process.env.PROJECTS_DIR,
      "/home/Marczelloo_pi/projects",
      "/home/pi/projects",
    ]
      .filter((root): root is string => Boolean(root))
      .map((root) => root.replace(/\\/g, "/").replace(/\/$/, ""));
    const normalizedCwd = effectiveCwd.replace(/\\/g, "/").replace(/\/$/, "");
    const hasTraversal = normalizedCwd.split("/").some((part: string) => part === "..");
    if (!normalizedCwd.startsWith("/") || hasTraversal || !allowedRoots.some((root) => normalizedCwd === root || normalizedCwd.startsWith(`${root}/`))) {
      return NextResponse.json({ error: "Working directory is outside the allowed project roots" }, { status: 400 });
    }

    console.log(`[Terminal] Executing command: "${command}" in cwd: ${effectiveCwd}`);

    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({ command, cwd: effectiveCwd }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: `Runner error: ${error}` }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    }
    console.error("Terminal error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Terminal error" }, { status: 500 });
  }
}
