import { NextRequest, NextResponse } from "next/server";
import { projects, services } from "@/server/atlashub";

/**
 * GET /api/projects/[id]/packages
 * Get available repo_paths for a project's services
 * Note: This endpoint helps the UI find which services have repo_path for package operations
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

    // Fetch services with repo_path for this project
    const allServices = await services.getServices({
      filters: [
        { operator: "eq", column: "project_id", value: id },
        { operator: "neq", column: "repo_path", value: "" }
      ],
      select: ["id", "name", "repo_path", "type"],
    });

    // Filter to only include services with non-null repo_path
    const servicesWithRepoPath = allServices.filter((s: any) => s.repo_path != null);

    // Extract available repo_paths
    const availableRepoPaths = servicesWithRepoPath.map((s) => ({
      service_id: s.id,
      service_name: s.name,
      repo_path: s.repo_path,
    }));

    // Detect ecosystem from lockfile presence (via service name/type heuristics for MVP)
    // Full ecosystem detection via file checking will be in Phase 3
    const ecosystem = "npm"; // MVP default

    return NextResponse.json({
      ecosystem,
      available_repo_paths: availableRepoPaths,
      default_repo_path: availableRepoPaths[0]?.repo_path || null,
      has_repo_path: availableRepoPaths.length > 0,
    });
  } catch (error) {
    console.error("Error fetching package info:", error);
    return NextResponse.json(
      { error: "Failed to fetch package info" },
      { status: 500 }
    );
  }
}
