import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

// Status file is in the mounted /projects directory (shared with runner via host mount)
const STATUS_FILE = process.env.DASHBOARD_REPO_PATH
  ? process.env.DASHBOARD_REPO_PATH.replace("/home/Marczelloo_pi/projects", "/projects") + "/.deploy-status.json"
  : "/projects/Marczelloo-dashboard/.deploy-status.json";

export const dynamic = "force-dynamic";

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
