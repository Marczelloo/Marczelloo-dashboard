import { NextResponse } from "next/server";
import { verifyPinAction } from "@/app/actions/auth";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export async function POST(request: Request) {
  try {
    // Verify PIN for terminal access
    const { command, cwd, pin } = await request.json();

    // Skip PIN check in development if DEV_SKIP_PIN is set
    const skipPin = process.env.DEV_SKIP_PIN === "true";

    if (!skipPin) {
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

    // Forward to runner
    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({ command, cwd }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: `Runner error: ${error}` }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Terminal error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Terminal error" }, { status: 500 });
  }
}
