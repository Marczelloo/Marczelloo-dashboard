/**
 * API Route: /api/github/repos/[owner]/[repo]
 * Get repository information
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isGitHubConfigured,
  getRepository,
  listCommits,
  listBranches,
  listPullRequests,
  listReleases,
  listSecurityAlerts,
  listContributors,
  getLatestRelease,
  GitHubError,
} from "@/server/github";
import type { GitHubRepoStats } from "@/types/github";

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
    const includeStats = searchParams.get("stats") === "true";

    // Get basic repo info
    const repository = await getRepository(owner, repo);

    if (!includeStats) {
      return NextResponse.json({ data: repository });
    }

    // Fetch additional stats in parallel
    const [commitsResult, branchesResult, prsResult, releasesResult, contributorsResult, latestRelease, alertsResult] =
      await Promise.allSettled([
        listCommits(owner, repo, { perPage: 1 }),
        listBranches(owner, repo, { perPage: 1 }),
        listPullRequests(owner, repo, { state: "open", perPage: 1 }),
        listReleases(owner, repo, { perPage: 1 }),
        listContributors(owner, repo, { perPage: 1 }),
        getLatestRelease(owner, repo),
        listSecurityAlerts(owner, repo, { state: "open", perPage: 1 }).catch(() => ({ data: [] })),
      ]);

    // Extract counts from pagination (GitHub provides total in Link header for some endpoints)
    const stats: GitHubRepoStats = {
      commits_count:
        commitsResult.status === "fulfilled"
          ? commitsResult.value.pagination?.lastPage || commitsResult.value.data.length
          : 0,
      branches_count:
        branchesResult.status === "fulfilled"
          ? branchesResult.value.pagination?.lastPage || branchesResult.value.data.length
          : 0,
      open_prs_count:
        prsResult.status === "fulfilled" ? prsResult.value.pagination?.lastPage || prsResult.value.data.length : 0,
      releases_count:
        releasesResult.status === "fulfilled"
          ? releasesResult.value.pagination?.lastPage || releasesResult.value.data.length
          : 0,
      contributors_count:
        contributorsResult.status === "fulfilled"
          ? contributorsResult.value.pagination?.lastPage || contributorsResult.value.data.length
          : 0,
      security_alerts_count: alertsResult.status === "fulfilled" ? alertsResult.value.data.length : 0,
      open_issues_count: repository.open_issues_count,
      last_commit:
        commitsResult.status === "fulfilled" && commitsResult.value.data[0] ? commitsResult.value.data[0] : null,
      last_release: latestRelease.status === "fulfilled" ? latestRelease.value : null,
    };

    return NextResponse.json({
      data: repository,
      stats,
    });
  } catch (error) {
    console.error("[GitHub Repo] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch repository" }, { status: 500 });
  }
}
