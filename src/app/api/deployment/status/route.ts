import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

// Status file paths
const STATUS_FILE_HOST = process.env.DASHBOARD_REPO_PATH
  ? `${process.env.DASHBOARD_REPO_PATH}/.deploy-status.json`
  : "/home/Marczelloo_pi/projects/Marczelloo-dashboard/.deploy-status.json";
const STATUS_FILE_MOUNT = process.env.DASHBOARD_REPO_PATH
  ? process.env.DASHBOARD_REPO_PATH.replace("/home/Marczelloo_pi/projects", "/projects") + "/.deploy-status.json"
  : "/projects/Marczelloo-dashboard/.deploy-status.json";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    console.log("[Deployment Status] DELETE request received");

    // Use runner to delete the file on host (projects dir is read-only in dashboard container)
    if (RUNNER_TOKEN) {
      const deleteCmd = `rm -f "${STATUS_FILE_HOST}"`;
      const response = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({ command: deleteCmd }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[Deployment Status] Status file deleted via runner:", result.success);
        return NextResponse.json({ success: true });
      } else {
        console.error("[Deployment Status] Failed to delete via runner:", response.status);
        return NextResponse.json({ success: false, error: "Failed to delete via runner" }, { status: 500 });
      }
    } else {
      console.error("[Deployment Status] RUNNER_TOKEN not configured");
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }
  } catch (error) {
    console.error("[Deployment Status] Error clearing status:", error);
    return NextResponse.json({ success: false, error: "Failed to clear status" }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!existsSync(STATUS_FILE)) {
      return NextResponse.json({
        status: "idle",
      });
    }

    const content = await readFile(STATUS_FILE, "utf-8");
    const data = JSON.parse(content);

    // Check if status is stale (older than 10 minutes for success, 30 minutes for deploying)
    const now = Date.now();
    const timestamp = data.timestamp ? new Date(data.timestamp).getTime() : 0;
    const age = now - timestamp;

    if (data.status === "success" && age > 10 * 60 * 1000) {
      // Success older than 10 minutes - reset to idle
      return NextResponse.json({ status: "idle" });
    }

    if (data.status === "deploying" && age > 30 * 60 * 1000) {
      // Deploying older than 30 minutes - probably stale, mark as failed
      return NextResponse.json({
        status: "failed",
        message: "Deployment timed out",
      });
    }

    // For success status, add canReload flag
    if (data.status === "success" && age < 10 * 60 * 1000) {
      data.canReload = true;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Deployment Status] Error reading status:", error);
    return NextResponse.json({
      status: "idle",
    });
  }
}
