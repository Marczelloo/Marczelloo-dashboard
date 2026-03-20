import { NextRequest, NextResponse } from "next/server";
import { projects, packageUpdates } from "@/server/atlashub";
import {
  npmCheck,
  npmUpdate,
  npmTest,
  npmBuild,
  npmBackup,
  npmRestore,
} from "@/server/runner";
import type { PackageEcosystem } from "@/types";

/**
 * POST /api/projects/[id]/packages/update
 * Update packages with optional test/build verification and rollback
 *
 * Body: {
 *   repo_path: string;
 *   packages?: string[];
 *   run_tests?: boolean;
 *   run_build?: boolean;
 *   is_github_project?: boolean;
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
    const {
      repo_path,
      packages = [],
      run_tests = true,
      run_build = false,
      is_github_project = false,
    } = body;

    if (!repo_path) {
      return NextResponse.json(
        { error: "repo_path is required" },
        { status: 400 }
      );
    }

    // Step 1: Get current state (before update)
    const beforeCheck = await npmCheck(repo_path);
    const oldVersions: Record<string, string> = {};
    beforeCheck.outdated.forEach((pkg) => {
      oldVersions[pkg.name] = pkg.current;
    });

    // For packages not showing as outdated but being explicitly updated
    packages.forEach((pkg: string) => {
      if (!oldVersions[pkg]) {
        oldVersions[pkg] = "unknown";
      }
    });

    // Step 2: Backup current package files
    const backupResult = await npmBackup(repo_path);
    if (!backupResult.success) {
      return NextResponse.json(
        { error: "Failed to backup package files", details: backupResult.error },
        { status: 500 }
      );
    }

    // Step 3: Create package update record (pending)
    const updateRecord = await packageUpdates.createPackageUpdate({
      project_id: id,
      ecosystem: "npm" as PackageEcosystem,
      packages_updated: packages.length > 0 ? packages : beforeCheck.outdated.map((p) => p.name),
      old_versions: oldVersions,
      new_versions: {}, // Will fill after update
      status: "pending",
      rollback_data: JSON.stringify(backupResult.backup),
    });

    // Step 4: Run the update
    const updateResult = await npmUpdate(
      repo_path,
      packages.length > 0 ? packages : undefined
    );

    if (!updateResult.success) {
      await packageUpdates.markAsFailed(
        updateRecord.id,
        updateResult.error || "Update failed"
      );
      return NextResponse.json(
        { error: "Package update failed", details: updateResult.error },
        { status: 500 }
      );
    }

    // Step 5: Get new versions
    // Use beforeCheck to capture all packages that were updated, including those now at latest
    const newVersions: Record<string, string> = {};
    beforeCheck.outdated.forEach((pkg) => {
      // Use 'latest' as the target version we updated to
      newVersions[pkg.name] = pkg.latest;
    });
    // Also include explicitly requested packages that weren't showing as outdated
    if (packages.length > 0) {
      packages.forEach((pkgName: string) => {
        if (!newVersions[pkgName]) {
          newVersions[pkgName] = "updated";
        }
      });
    }
    // Updated packages list
    const allUpdated = packages.length > 0 ? packages : beforeCheck.outdated.map((p) => p.name);

    // Step 6: Run tests if requested
    let testPassed = true;
    let testOutput = "";
    if (run_tests) {
      const testResult = await npmTest(repo_path);
      testPassed = testResult.success;
      testOutput = testResult.output;

      if (!testPassed) {
        // Auto-rollback on test failure
        await npmRestore(repo_path, backupResult.backup);
        await packageUpdates.markAsRolledBack(
          updateRecord.id,
          `Tests failed: ${testResult.error || testOutput.slice(0, 500)}`
        );

        return NextResponse.json(
          {
            error: "Tests failed, packages rolled back",
            update_id: updateRecord.id,
            test_output: testOutput,
          },
          { status: 400 }
        );
      }
    }

    // Step 7: Run build if requested
    let buildPassed = true;
    let buildOutput = "";
    if (run_build) {
      const buildResult = await npmBuild(repo_path);
      buildPassed = buildResult.success;
      buildOutput = buildResult.output;

      if (!buildPassed) {
        // Auto-rollback on build failure
        await npmRestore(repo_path, backupResult.backup);
        await packageUpdates.markAsRolledBack(
          updateRecord.id,
          `Build failed: ${buildResult.error || buildOutput.slice(0, 500)}`
        );

        return NextResponse.json(
          {
            error: "Build failed, packages rolled back",
            update_id: updateRecord.id,
            build_output: buildOutput,
          },
          { status: 400 }
        );
      }
    }

    // Step 8: Update record with new_versions and mark as success
    await packageUpdates.updatePackageUpdate(updateRecord.id, {
      new_versions: newVersions,
    });
    await packageUpdates.markAsSuccess(updateRecord.id);

    // Note: GitHub integration (commit, push to feature branch) is Phase 4
    // For MVP, updates are applied directly to the local repo

    return NextResponse.json({
      success: true,
      update_id: updateRecord.id,
      updated: allUpdated,
      test_passed: testPassed,
      build_passed: buildPassed,
      new_versions: newVersions,
    });
  } catch (error) {
    console.error("Error updating packages:", error);
    return NextResponse.json(
      { error: "Failed to update packages" },
      { status: 500 }
    );
  }
}
