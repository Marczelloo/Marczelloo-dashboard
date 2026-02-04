/**
 * API Route: /api/github/repos/[owner]/[repo]/commits
 * Get repository commits
 */

import { NextRequest, NextResponse } from "next/server";
import { isGitHubConfigured, listCommits, GitHubError } from "@/server/github";

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

    const options = {
      sha: searchParams.get("sha") || undefined,
      path: searchParams.get("path") || undefined,
      author: searchParams.get("author") || undefined,
      since: searchParams.get("since") || undefined,
      until: searchParams.get("until") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: Math.min(parseInt(searchParams.get("per_page") || "30", 10), 100),
    };

    const result = await listCommits(owner, repo, options);

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[GitHub Commits] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch commits" }, { status: 500 });
  }
}
