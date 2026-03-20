import { NextRequest, NextResponse } from "next/server";
import { projects, packageUpdates } from "@/server/atlashub";
import { npmRestore, npmBackup } from "@/server/runner";

/**
 * POST /api/projects/[id]/packages/rollback
 * Rollback to a previous package state
 *
 * Body: { update_id: string; repo_path: string }
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
    const { update_id, repo_path } = body;

    if (!update_id) {
      return NextResponse.json(
        { error: "update_id is required" },
        { status: 400 }
      );
    }

    if (!repo_path) {
      return NextResponse.json(
        { error: "repo_path is required" },
        { status: 400 }
      );
    }

    // Get the update record
    const updateRecord = await packageUpdates.getPackageUpdateById(update_id);

    if (!updateRecord || updateRecord.project_id !== id) {
      return NextResponse.json(
        { error: "Update not found" },
        { status: 404 }
      );
    }

    if (!updateRecord.rollback_data) {
      return NextResponse.json(
        { error: "No rollback data available for this update" },
        { status: 400 }
      );
    }

    // Backup current state before rolling back
    const currentBackup = await npmBackup(repo_path);
    if (!currentBackup.success) {
      return NextResponse.json(
        { error: "Failed to backup current state before rollback", details: currentBackup.error },
        { status: 500 }
      );
    }

    // Restore the old package files
    let backupData: Partial<Record<string, string>>;
    try {
      backupData = JSON.parse(updateRecord.rollback_data);
    } catch {
      return NextResponse.json(
        { error: "Invalid rollback data format" },
        { status: 400 }
      );
    }
    const restoreResult = await npmRestore(repo_path, backupData);

    if (!restoreResult.success) {
      return NextResponse.json(
        { error: "Rollback failed", details: restoreResult.error },
        { status: 500 }
      );
    }

    // Create a new update record for the rollback
    await packageUpdates.createPackageUpdate({
      project_id: id,
      ecosystem: updateRecord.ecosystem,
      packages_updated: updateRecord.packages_updated,
      old_versions: updateRecord.new_versions, // Swapped: current becomes old
      new_versions: updateRecord.old_versions, // Swapped: old becomes new
      status: "success",
      rollback_data: JSON.stringify(currentBackup.backup || {}),
      rollback_from_id: update_id, // Track which update we rolled back
    });

    return NextResponse.json({
      success: true,
      message: "Rollback completed",
      rolled_back_from: update_id,
    });
  } catch (error) {
    console.error("Error rolling back packages:", error);
    return NextResponse.json(
      { error: "Failed to rollback packages" },
      { status: 500 }
    );
  }
}
