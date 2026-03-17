import { NextRequest, NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const { repoPath, filename } = await request.json();

    if (!repoPath) {
      return NextResponse.json(
        { success: false, error: "repoPath is required" },
        { status: 400 }
      );
    }

    if (!RUNNER_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Runner not configured" },
        { status: 500 }
      );
    }

    const envFile = filename || ".env";
    const filePath = `${repoPath}/${envFile}`;

    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cat "${filePath}" 2>/dev/null || echo ""`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { success: false, error: `Runner error: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const content = result.stdout || "";

    return NextResponse.json({
      success: true,
      content,
      filename: envFile,
    });
  } catch (error) {
    console.error("[Env Export] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to export env file" },
      { status: 500 }
    );
  }
}
