/**
 * API Route: /api/github/repos/[owner]/[repo]/security
 * Get repository security alerts (Dependabot)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isGitHubConfigured,
  listSecurityAlerts,
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
      const state = query.get("state");
      const severity = query.get("severity");
      let alerts = data.security;
      if (state) {
        alerts = alerts.filter((alert) => alert.state === state);
      }
      if (severity) {
        alerts = alerts.filter(
          (alert) => alert.security_vulnerability.severity === severity,
        );
      }
      const result = demoGithubPage(alerts, pageOptions(query));
      const bySeverity = result.data.reduce<Record<string, number>>(
        (acc, alert) => {
          const key = alert.security_vulnerability.severity;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {},
      );
      return NextResponse.json({
        data: result.data,
        pagination: result.pagination,
        summary: { total: result.data.length, bySeverity },
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
      state:
        (searchParams.get("state") as "open" | "dismissed" | "fixed") ||
        undefined,
      severity: searchParams.get("severity") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: Math.min(
        parseInt(searchParams.get("per_page") || "30", 10),
        100,
      ),
    };

    const result = await listSecurityAlerts(owner, repo, options);

    // Group by severity for summary
    const bySeverity = result.data.reduce(
      (acc, alert) => {
        const severity = alert.security_vulnerability.severity;
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
      summary: {
        total: result.data.length,
        bySeverity,
      },
    });
  } catch (error) {
    console.error("[GitHub Security] Error:", error);

    if (error instanceof GitHubError) {
      // Dependabot alerts may not be enabled or accessible
      if (error.statusCode === 403) {
        return NextResponse.json({
          data: [],
          summary: { total: 0, bySeverity: {} },
          message:
            "Dependabot alerts are not enabled or accessible for this repository",
        });
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch security alerts" },
      { status: 500 },
    );
  }
}
