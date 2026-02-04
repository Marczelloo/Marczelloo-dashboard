/**
 * API Route: /api/github/repos/[owner]/[repo]/compare
 * Compare two branches/commits/tags
 */

import { NextRequest, NextResponse } from "next/server";
import { isGitHubConfigured, compareCommits, GitHubError } from "@/server/github";

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: "GitHub App not configured" }, { status: 503 });
    }

    const { owner, repo } = await params;
    const searchParams = request.nextUrl.searchParams;

    const base = searchParams.get("base");
    const head = searchParams.get("head");

    if (!base || !head) {
      return NextResponse.json({ error: "Both 'base' and 'head' query parameters are required" }, { status: 400 });
    }

    const result = await compareCommits(owner, repo, base, head);

    return NextResponse.json({
      data: {
        status: result.status,
        ahead_by: result.ahead_by,
        behind_by: result.behind_by,
        total_commits: result.total_commits,
        commits: result.commits.slice(0, 10), // Limit commits returned
      },
    });
  } catch (error) {
    console.error("[GitHub Compare] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to compare branches" }, { status: 500 });
  }
}
