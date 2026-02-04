import { NextRequest, NextResponse } from "next/server";
import { getContents, isGitHubConfigured, GitHubError } from "@/server/github";

/**
 * GET /api/github/repos/[owner]/[repo]/contents
 * Get file or directory contents from a repository
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path") || "";
  const ref = searchParams.get("ref") || undefined;

  if (!isGitHubConfigured()) {
    return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
  }

  try {
    const contents = await getContents(owner, repo, path, ref);
    return NextResponse.json({ data: contents });
  } catch (error) {
    console.error("Failed to get contents:", error);

    if (error instanceof GitHubError) {
      if (error.statusCode === 404) {
        return NextResponse.json({ error: "File or directory not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Failed to fetch contents" }, { status: 500 });
  }
}
