/**
 * API Route: /api/github/repos/[owner]/[repo]/code-scanning
 * Get code scanning alerts (CodeQL)
 */

import { NextRequest, NextResponse } from "next/server";
import { isGitHubConfigured, GitHubError, githubRequest } from "@/server/github";

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

interface CodeScanningAlert {
  number: number;
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
  state: "open" | "closed" | "dismissed" | "fixed";
  dismissed_by: { login: string } | null;
  dismissed_at: string | null;
  dismissed_reason: string | null;
  rule: {
    id: string;
    severity: "none" | "note" | "warning" | "error";
    security_severity_level: "low" | "medium" | "high" | "critical" | null;
    description: string;
    name: string;
    tags: string[];
  };
  tool: {
    name: string;
    version: string | null;
  };
  most_recent_instance: {
    ref: string;
    state: string;
    commit_sha: string;
    message: {
      text: string;
    };
    location: {
      path: string;
      start_line: number;
      end_line: number;
      start_column: number;
      end_column: number;
    };
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: "GitHub App not configured" }, { status: 503 });
    }

    const { owner, repo } = await params;
    const searchParams = request.nextUrl.searchParams;

    const state = searchParams.get("state") || "open";
    const severity = searchParams.get("severity");
    const tool = searchParams.get("tool");
    const perPage = Math.min(parseInt(searchParams.get("per_page") || "30", 10), 100);
    const page = parseInt(searchParams.get("page") || "1", 10);

    let url = `/repos/${owner}/${repo}/code-scanning/alerts?state=${state}&per_page=${perPage}&page=${page}`;
    if (severity) url += `&severity=${severity}`;
    if (tool) url += `&tool_name=${tool}`;

    const alerts = await githubRequest<CodeScanningAlert[]>(url);

    // Count by severity
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    alerts.forEach((alert: CodeScanningAlert) => {
      const level = alert.rule.security_severity_level || "none";
      if (level in severityCounts) {
        severityCounts[level as keyof typeof severityCounts]++;
      }
    });

    return NextResponse.json({
      data: alerts,
      summary: {
        total: alerts.length,
        by_severity: severityCounts,
      },
    });
  } catch (error) {
    console.error("[GitHub Code Scanning] Error:", error);

    if (error instanceof GitHubError) {
      // Code scanning may not be enabled
      if (error.statusCode === 404 || error.statusCode === 403) {
        return NextResponse.json({
          data: [],
          summary: {
            total: 0,
            by_severity: { critical: 0, high: 0, medium: 0, low: 0, none: 0 },
          },
          message: "Code scanning is not enabled for this repository",
        });
      }
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch code scanning alerts" }, { status: 500 });
  }
}
