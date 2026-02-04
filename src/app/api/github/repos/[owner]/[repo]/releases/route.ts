/**
 * API Route: /api/github/repos/[owner]/[repo]/releases
 * Get and create repository releases
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isGitHubConfigured,
  listReleases,
  getLatestRelease,
  createRelease,
  generateReleaseNotes,
  GitHubError,
} from "@/server/github";

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

    // Check if requesting only latest
    if (searchParams.get("latest") === "true") {
      const latest = await getLatestRelease(owner, repo);
      return NextResponse.json({ data: latest });
    }

    const options = {
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: Math.min(parseInt(searchParams.get("per_page") || "30", 10), 100),
    };

    const result = await listReleases(owner, repo, options);

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[GitHub Releases] Error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch releases" }, { status: 500 });
  }
}

/**
 * POST - Create a new release
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: "GitHub App not configured" }, { status: 503 });
    }

    const { owner, repo } = await params;
    const body = await request.json();

    const {
      tagName,
      name,
      description,
      draft = false,
      prerelease = false,
      targetCommitish,
      autoGenerateNotes = false,
      previousTag,
    } = body;

    if (!tagName) {
      return NextResponse.json({ error: "tagName is required" }, { status: 400 });
    }

    let releaseBody = description || "";

    // Auto-generate release notes if requested
    if (autoGenerateNotes) {
      try {
        const notes = await generateReleaseNotes(owner, repo, tagName, previousTag, targetCommitish);
        releaseBody = notes.body;
      } catch (notesError) {
        console.warn("[GitHub Releases] Failed to generate notes:", notesError);
        // Continue with empty body if generation fails
      }
    }

    const release = await createRelease(owner, repo, tagName, {
      name: name || tagName,
      body: releaseBody,
      draft,
      prerelease,
      targetCommitish,
      generateReleaseNotes: autoGenerateNotes && !releaseBody,
    });

    return NextResponse.json({
      data: release,
      message: `Release ${tagName} created successfully`,
    });
  } catch (error) {
    console.error("[GitHub Releases] Create error:", error);

    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to create release" }, { status: 500 });
  }
}
