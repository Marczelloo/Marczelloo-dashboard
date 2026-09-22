/**
 * API Route: /api/github/repos/[owner]/[repo]/issues
 * Get repository issues
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isGitHubConfigured,
  listIssues,
  getIssue,
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
      const query = request.nextUrl.searchParams;
      const number = query.get("number");
      if (number) {
        const issue = data.issues.find(
          (item) => item.number === parseInt(number, 10),
        );
        return issue
          ? NextResponse.json({ data: issue })
          : NextResponse.json({ error: "Not Found" }, { status: 404 });
      }
      const state = query.get("state") || "open";
      const issues =
        state === "all"
          ? data.issues
          : data.issues.filter((issue) => issue.state === state);
      const result = demoGithubPage(issues, pageOptions(query));
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

    // Check if requesting a specific issue
    const issueNumber = searchParams.get("number");
    if (issueNumber) {
      const issue = await getIssue(owner, repo, parseInt(issueNumber, 10));
      return NextResponse.json({ data: issue });
    }

    const options = {
      state: (searchParams.get("state") as "open" | "closed" | "all") || "open",
      labels: searchParams.get("labels") || undefined,
      sort: searchParams.get("sort") || undefined,
      direction: searchParams.get("direction") || undefined,
      since: searchParams.get("since") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: Math.min(
        parseInt(searchParams.get("per_page") || "30", 10),
        100,
      ),
    };

    const result = await listIssues(owner, repo, options);

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const issuesOnly = result.data.filter(
      (issue) => !("pull_request" in issue),
    );

    return NextResponse.json({
      data: issuesOnly,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[GitHub Issues] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 },
    );
  }
}
