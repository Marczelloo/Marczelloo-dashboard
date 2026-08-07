import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { AuthError, requireAuth } from "@/server/lib/auth";
import { shellQuote } from "@/server/runner/safe-paths";

const DASHBOARD_REPO_PATH = process.env.DASHBOARD_REPO_PATH || "/home/Marczelloo_pi/projects/Marczelloo-dashboard";
const STATUS_FILE_HOST = `${DASHBOARD_REPO_PATH}/.deploy-status.json`;
const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;
const LOG_FILE_PATTERN = /^\/tmp\/(?:deploy|self)-[A-Za-z0-9_.-]+\.log$/;

export const dynamic = "force-dynamic";

function statusMountPath(): string {
  const roots = [
    [process.env.PROJECTS_DIR, "/projects"],
    ["/home/Marczelloo_pi/projects", "/projects"],
    ["/home/pi/projects", "/projects"],
  ] as const;

  for (const [hostRoot, mountRoot] of roots) {
    if (hostRoot && DASHBOARD_REPO_PATH.startsWith(`${hostRoot}/`)) {
      return `${mountRoot}${DASHBOARD_REPO_PATH.slice(hostRoot.length)}/.deploy-status.json`;
    }
  }

  return "/projects/Marczelloo-dashboard/.deploy-status.json";
}

function normalizeStatus(data: Record<string, unknown>): Record<string, unknown> {
  const status = ["deploying", "success", "failed"].includes(String(data.status)) ? data.status : "idle";
  const progress = typeof data.progress === "number" ? Math.max(0, Math.min(100, Math.round(data.progress))) : undefined;
  const logFile = typeof data.logFile === "string" && LOG_FILE_PATTERN.test(data.logFile) ? data.logFile : undefined;

  return {
    status,
    ...(typeof data.message === "string" ? { message: data.message.slice(0, 500) } : {}),
    ...(typeof data.commit === "string" ? { commit: data.commit.slice(0, 64) } : {}),
    ...(typeof data.timestamp === "string" ? { timestamp: data.timestamp } : {}),
    ...(typeof data.step === "string" ? { step: data.step.slice(0, 64) } : {}),
    ...(progress !== undefined ? { progress } : {}),
    ...(typeof data.jobId === "string" ? { jobId: data.jobId.slice(0, 100) } : {}),
    ...(logFile ? { logFile } : {}),
    ...(data.rollback === true ? { rollback: true } : {}),
  };
}

export async function DELETE() {
  try {
    await requireAuth();

    if (!RUNNER_TOKEN) {
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({ command: `rm -f ${shellQuote(STATUS_FILE_HOST)}` }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      return NextResponse.json({ success: false, error: result.stderr || "Failed to clear status" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    }
    console.error("[Deployment Status] Error clearing status:", error);
    return NextResponse.json({ success: false, error: "Failed to clear status" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAuth();

    const statusFile = statusMountPath();
    if (!existsSync(statusFile)) return NextResponse.json({ status: "idle" });

    const content = await readFile(statusFile, "utf-8");
    const raw = JSON.parse(content) as Record<string, unknown>;
    const data = normalizeStatus(raw);
    const timestamp = typeof data.timestamp === "string" ? new Date(data.timestamp).getTime() : 0;
    const age = timestamp > 0 ? Date.now() - timestamp : Number.POSITIVE_INFINITY;

    if (data.status === "success" && age > 10 * 60 * 1000) return NextResponse.json({ status: "idle" });

    if (data.status === "deploying" && age > 30 * 60 * 1000) {
      return NextResponse.json({
        ...data,
        status: "failed",
        message: "Deployment timed out",
        step: "timeout",
        progress: 100,
      });
    }

    if (data.status === "success") data.canReload = true;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    }
    console.error("[Deployment Status] Error reading status:", error);
    return NextResponse.json({ status: "idle" });
  }
}
