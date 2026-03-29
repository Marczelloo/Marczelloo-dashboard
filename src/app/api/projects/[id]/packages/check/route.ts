import { NextRequest, NextResponse } from "next/server";
import { projects } from "@/server/atlashub";
import { npmCheck, containerNpmCheck } from "@/server/runner";

/**
 * POST /api/projects/[id]/packages/check
 * Check for available package updates
 *
 * Body: {
 *   repo_path?: string,
 *   service_name?: string,
 *   container_name?: string,
 *   check_type?: "auto" | "host" | "container"
 * }
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
    const { repo_path, service_name, container_name, check_type = "auto" } = body;

    console.log(`[Check API] Checking packages for project ${id}:`, {
      repo_path,
      service_name,
      container_name,
      check_type
    });

    let result;
    let checkMode: "host" | "container";

    // Determine which check mode to use
    if (check_type === "container" || (check_type === "auto" && container_name)) {
      // Container-based check
      if (!container_name) {
        return NextResponse.json(
          { error: "container_name is required for container checks" },
          { status: 400 }
        );
      }

      console.log(`[Check API] Checking packages in container: ${container_name}`);
      result = await containerNpmCheck(container_name);
      checkMode = "container";
    } else {
      // Host-based check
      if (!repo_path) {
        return NextResponse.json(
          { error: "repo_path is required for host checks" },
          { status: 400 }
        );
      }

      console.log(`[Check API] Checking packages on host: ${repo_path}`);
      result = await npmCheck(repo_path);
      checkMode = "host";
    }

    if (!result.success) {
      console.error(`[Check API] Package check failed (${checkMode}):`, result.error);
      return NextResponse.json(
        {
          error: result.error || "Failed to check packages",
          check_mode: checkMode
        },
        { status: 500 }
      );
    }

    console.log(`[Check API] Found ${result.outdated.length} outdated packages (${checkMode})`);

    // Add service_name and container info to each outdated package
    const outdatedWithMeta = result.outdated.map(pkg => ({
      ...pkg,
      service_name: service_name || null,
      container_name: checkMode === "container" ? container_name : null,
    }));

    const response = {
      ecosystem: "npm" as const,
      check_mode: checkMode,
      outdated: outdatedWithMeta,
      outdated_count: result.outdated.length,
      checked_at: new Date().toISOString(),
    };

    console.log(`[Check API] Returning response:`, {
      check_mode: checkMode,
      outdated_count: response.outdated_count,
      package_names: response.outdated.map(p => p.name)
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Check API] Error checking packages:", error);
    return NextResponse.json(
      { error: "Failed to check packages" },
      { status: 500 }
    );
  }
}
