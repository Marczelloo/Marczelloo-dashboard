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

    // Check if there are uncommitted changes OR unpushed commits
    const statusResponse = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cd "${DASHBOARD_REPO_PATH}" && git fetch --quiet origin 2>/dev/null; git status --porcelain && git rev-parse HEAD && git rev-parse @{u} 2>/dev/null || echo "no-upstream"`,
      }),
    });

    // Status flags
    let hasLocalChanges = false;
    let hasUnpushedCommits = false;

    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      const stdout = statusResult.stdout || "";
      const lines = stdout.trim().split("\n");

      // Check for uncommitted changes (any line from git status --porcelain)
      const statusLineIndex = lines.findIndex((l: string) => /^[MADRCU?][MADRCU? ]/.test(l));
      hasLocalChanges = statusLineIndex !== -1;

      // Find HEAD and upstream commit SHA
      const headIndex = lines.findIndex((l: string) => /^[a-f0-9]{40}$/i.test(l));
      const upstreamIndex = lines.findIndex((l: string, i: number) => i > headIndex && /^[a-f0-9]{40}$/i.test(l));

      // Check if HEAD is ahead/behind or has no upstream
      if (headIndex !== -1 && upstreamIndex !== -1) {
        const localHead = lines[headIndex];
        const upstreamHead = lines[upstreamIndex];
        hasUnpushedCommits = localHead !== upstreamHead;
      } else if (headIndex !== -1) {
        // No upstream configured - consider as unpushed if there's a commit
        hasUnpushedCommits = true;
      }
    }

    // Determine overall status
    const hasUncommittedChanges = hasLocalChanges || hasUnpushedCommits;

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
        hasLocalChanges,
        hasUnpushedCommits,
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
