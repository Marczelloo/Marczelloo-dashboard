/**
 * API Route: /api/github/status
 * Check if GitHub integration is configured and working
 */

import { NextResponse } from "next/server";
import {
  isGitHubConfigured,
  getRateLimitStatus,
  listRepositories,
} from "@/server/github";
import { requireAuth } from "@/server/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import { listDemoGithubRepos } from "@/server/demo/github";

export async function GET() {
  try {
    if (isDemoMode()) {
      const repos = listDemoGithubRepos({ page: 1, perPage: 100 });
      return NextResponse.json({
        configured: true,
        connected: true,
        repoCount: repos.pagination.totalCount,
        rateLimit: {
          remaining: 4_987,
          limit: 5_000,
          resetsAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      });
    }
    await requireAuth();
    const configured = isGitHubConfigured();

    if (!configured) {
      return NextResponse.json({
        configured: false,
        message:
          "GitHub App not configured. Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY_BASE64, and GITHUB_INSTALLATION_ID.",
      });
    }

    // Try to list repos to verify the connection works
    try {
      const repos = await listRepositories(1, 1);
      const rateLimit = getRateLimitStatus();

      return NextResponse.json({
        configured: true,
        connected: true,
        repoCount: repos.pagination?.totalCount ?? repos.data.length,
        rateLimit: rateLimit
          ? {
              remaining: rateLimit.remaining,
              limit: rateLimit.limit,
              resetsAt: new Date(rateLimit.reset * 1000).toISOString(),
            }
          : null,
      });
    } catch (error) {
      return NextResponse.json({
        configured: true,
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("[GitHub Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to check GitHub status" },
      { status: 500 },
    );
  }
}
