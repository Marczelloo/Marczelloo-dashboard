/**
 * API Route: /api/github/repos/[owner]/[repo]/contributors
 * Get repository contributors
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isGitHubConfigured,
  listContributors,
  GitHubError,
} from "@/server/github";
import { requireAuth } from "@/server/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoGithubPage,
  demoRepoFromParams,
  pageOptions,
} from "@/server/demo/github";

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (isDemoMode()) {
      const data = await demoRepoFromParams(params);
      if (!data) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
      }
      const result = demoGithubPage(
        data.contributors,
        pageOptions(request.nextUrl.searchParams),
      );
      return NextResponse.json({
        data: result.data,
        pagination: result.pagination,
      });
    }
    await requireAuth();
    if (!isGitHubConfigured()) {
      return NextResponse.json(
        { error: "GitHub App not configured" },
        { status: 503 },
      );
    }

    const { owner, repo } = await params;
    const searchParams = request.nextUrl.searchParams;

    const options = {
      anon: searchParams.get("anon") === "true",
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: Math.min(
        parseInt(searchParams.get("per_page") || "30", 10),
        100,
      ),
    };

    const result = await listContributors(owner, repo, options);

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[GitHub Contributors] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch contributors" },
      { status: 500 },
    );
  }
}
