/**
 * API Route: /api/github/repos
 * List repositories accessible to the GitHub App installation
 */

import { NextRequest, NextResponse } from "next/server";
import { isGitHubConfigured, listRepositories, GitHubError } from "@/server/github";

export async function GET(request: NextRequest) {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: "GitHub App not configured" }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("per_page") || "30", 10);

    const result = await listRepositories(page, Math.min(perPage, 100));

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[GitHub Repos] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 });
  }
}
