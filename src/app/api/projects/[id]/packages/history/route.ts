import { NextRequest, NextResponse } from "next/server";
import { projects, packageUpdates } from "@/server/atlashub";

/**
 * GET /api/projects/[id]/packages/history
 * Get package update history for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await projects.getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const history = await packageUpdates.getPackageUpdates(id);

    return NextResponse.json({
      history,
      count: history.length,
    });
  } catch (error) {
    console.error("Error fetching package history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
