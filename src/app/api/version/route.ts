import { NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;
// The project path for the dashboard itself
const DASHBOARD_REPO_PATH = process.env.DASHBOARD_REPO_PATH || "/home/Marczelloo_pi/projects/Marczelloo-dashboard";

export async function GET() {
  try {
    if (!RUNNER_TOKEN) {
      return NextResponse.json({ error: "Runner not configured" }, { status: 500 });
    }

    // Get current git commit info
    const gitResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cd "${DASHBOARD_REPO_PATH}" && git log -1 --format="%H|%an|%ar|%s" && git rev-parse --abbrev-ref HEAD`,
      }),
    });

    if (!gitResponse.ok) {
      return NextResponse.json({ error: "Failed to get git info" }, { status: 500 });
    }

    const gitResult = await gitResponse.json();
    if (!gitResult.success) {
      return NextResponse.json({ error: "Failed to get git info" }, { status: 500 });
    }

    const lines = (gitResult.stdout || "").trim().split("\n");
    const [commitInfo, branch] = lines;
    const [commitHash, author, relativeDate, subject] = commitInfo.split("|");

    // Get package.json version
    const versionResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cd "${DASHBOARD_REPO_PATH}" && grep -oP '"version": "\\K[^"]+' package.json || echo "unknown"`,
      }),
    });

    let packageVersion = "unknown";
    if (versionResponse.ok) {
      const versionResult = await versionResponse.json();
      if (versionResult.success) {
        packageVersion = versionResult.stdout?.trim() || "unknown";
      }
    }

    // Check if there are uncommitted changes
    const statusResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cd "${DASHBOARD_REPO_PATH}" && git status --porcelain`,
      }),
    });

    let hasUncommittedChanges = false;
    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      hasUncommittedChanges = !!(statusResult.stdout?.trim().length > 0);
    }

    return NextResponse.json({
      success: true,
      version: {
        commit: commitHash,
        shortCommit: commitHash?.slice(0, 8) || "unknown",
        author,
        relativeDate,
        subject,
        branch,
        packageVersion,
        hasUncommittedChanges,
      },
    });
  } catch (error) {
    console.error("[Version] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get version info" },
      { status: 500 }
    );
  }
}
