import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { generateReleaseNotes, GitHubError, isGitHubConfigured } from "@/server/github";
import { requireAuth } from "@/server/lib/auth";

interface RouteParams {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * POST /api/github/repos/[owner]/[repo]/releases/notes
 * Notes GitHub would write for a release between two tags. Reads only; nothing is created.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ error: "Not available in the demo." }, { status: 403 });
    }
    await requireAuth();
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: "GitHub App not configured" }, { status: 503 });
    }

    const { owner, repo } = await params;
    const { tagName, previousTag } = (await request.json()) as { tagName?: string; previousTag?: string };
    if (!tagName) {
      return NextResponse.json({ error: "tagName is required" }, { status: 400 });
    }

    const notes = await generateReleaseNotes(owner, repo, tagName, previousTag || undefined);
    return NextResponse.json({ data: notes });
  } catch (error) {
    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Could not generate the notes" }, { status: 500 });
  }
}
