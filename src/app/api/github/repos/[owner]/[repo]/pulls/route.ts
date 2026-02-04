/**
 * API Route: /api/github/repos/[owner]/[repo]/pulls
 * Get repository pull requests
 */

import { NextRequest, NextResponse } from "next/server";
import { isGitHubConfigured, listPullRequests, getPullRequest, GitHubError } from "@/server/github";

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

    // Check if requesting a specific PR
    const prNumber = searchParams.get("number");
    if (prNumber) {
      const pr = await getPullRequest(owner, repo, parseInt(prNumber, 10));
      return NextResponse.json({ data: pr });
    }

    const options = {
      state: (searchParams.get("state") as "open" | "closed" | "all") || "open",
      sort: searchParams.get("sort") || undefined,
      direction: searchParams.get("direction") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: Math.min(parseInt(searchParams.get("per_page") || "30", 10), 100),
    };

    const result = await listPullRequests(owner, repo, options);

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[GitHub PRs] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch pull requests" }, { status: 500 });
  }
}
