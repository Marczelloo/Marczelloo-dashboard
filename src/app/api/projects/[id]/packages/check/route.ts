import { NextRequest, NextResponse } from "next/server";
import { projects } from "@/server/atlashub";
import { npmCheck } from "@/server/runner";

/**
 * POST /api/projects/[id]/packages/check
 * Check for available package updates
 *
 * Body: { repo_path: string, service_name?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await projects.getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { repo_path, service_name } = body;

    if (!repo_path) {
      return NextResponse.json(
        { error: "repo_path is required" },
        { status: 400 }
      );
    }

    const result = await npmCheck(repo_path);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to check packages" },
        { status: 500 }
      );
    }

    // Add service_name to each outdated package
    const outdatedWithService = result.outdated.map(pkg => ({
      ...pkg,
      service_name: service_name || null,
    }));

    return NextResponse.json({
      ecosystem: "npm",
      outdated: outdatedWithService,
      outdated_count: result.outdated.length,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking packages:", error);
    return NextResponse.json(
      { error: "Failed to check packages" },
      { status: 500 }
    );
  }
}
