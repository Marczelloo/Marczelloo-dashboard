import { NextRequest, NextResponse } from "next/server";
import { projects } from "@/server/atlashub";

/**
 * POST /api/projects/[id]/packages/diagnose
 * Diagnose package checking issues
 *
 * Body: { repo_path: string }
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
    const { repo_path } = body;

    if (!repo_path) {
      return NextResponse.json(
        { error: "repo_path is required" },
        { status: 400 }
      );
    }

    // Map host path to container path
    const containerPath = repo_path
      .replace(/^\/home\/pi\/projects\//, "/projects/")
      .replace(/^\/home\/Marczelloo_pi\/projects\//, "/projects/");

    console.log(`[Diagnose] Checking path: ${repo_path} -> ${containerPath}`);

    // Fetch runner config
    const runnerUrl = process.env.RUNNER_URL;
    const runnerToken = process.env.RUNNER_TOKEN;

    if (!runnerUrl || !runnerToken) {
      throw new Error("Runner configuration missing");
    }

    const diagnostics: Record<string, any> = {
      repo_path,
      container_path: containerPath,
      host_path: repo_path, // This is the path on the host machine
      checks: {},
    };

    // Helper function to execute command via runner's shell endpoint (SSH to host)
    // When using SSH, we must use the host_path, not container_path
    async function executeViaShell(cmd: string): Promise<{ success: boolean; stdout: string; stderr: string; exit_code?: number }> {
      const response = await fetch(`${runnerUrl}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          command: cmd,
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const error = await response.text().catch(() => response.statusText);
        return { success: false, stdout: "", stderr: error };
      }

      const result = await response.json();
      return {
        success: result.exit_code === 0 || (!result.exit_code && !result.stderr),
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exit_code: result.exit_code,
      };
    }

    // Helper function to execute via runner's execute endpoint (inside container)
    // When using execute, we must use the container_path
    async function executeViaExecute(operation: string, options?: Record<string, any>): Promise<{ success: boolean; output?: string; error?: string }> {
      const response = await fetch(`${runnerUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          operation,
          target: { repo_path: containerPath },
          options,
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const error = await response.text().catch(() => response.statusText);
        return { success: false, error };
      }

      const result = await response.json();
      return { success: result.success, output: result.output, error: result.error };
    }

    // Check 1: Does the directory exist on the host? (use shell/host_path)
    console.log("[Diagnose] Checking if directory exists on host...");
    const dirResult = await executeViaShell(`test -d "${repo_path}" && echo "EXISTS" || echo "NOT_FOUND"`);
    diagnostics.checks.host_directory_exists = dirResult.stdout.trim() === "EXISTS";
    diagnostics.checks.host_directory_error = dirResult.stderr;

    // Check 2: List directory contents to see what's there
    if (diagnostics.checks.host_directory_exists) {
      const lsResult = await executeViaShell(`ls -la "${repo_path}"`);
      diagnostics.checks.directory_listing = lsResult.stdout;
    }

    // Check 3: Does package.json exist?
    const packageJsonResult = await executeViaShell(`test -f "${repo_path}/package.json" && echo "EXISTS" || echo "NOT_FOUND"`);
    diagnostics.checks.package_json_exists = packageJsonResult.stdout.trim() === "EXISTS";

    // Check 4: Read package.json to get project info
    if (diagnostics.checks.package_json_exists) {
      const catResult = await executeViaShell(`cat "${repo_path}/package.json"`);
      if (catResult.success && catResult.stdout) {
        try {
          const packageJson = JSON.parse(catResult.stdout);
          diagnostics.checks.package_name = packageJson.name;
          diagnostics.checks.dependencies_count = Object.keys(packageJson.dependencies || {}).length;
          diagnostics.checks.dev_dependencies_count = Object.keys(packageJson.devDependencies || {}).length;
          diagnostics.checks.package_manager = packageJson.packageManager || "npm (unknown)";

          // Detect package manager
          if (packageJson.packageManager?.includes("pnpm")) {
            diagnostics.checks.detected_manager = "pnpm";
          } else if (packageJson.packageManager?.includes("yarn")) {
            diagnostics.checks.detected_manager = "yarn";
          } else if (packageJson.packageManager?.includes("bun")) {
            diagnostics.checks.detected_manager = "bun";
          } else {
            diagnostics.checks.detected_manager = "npm";
          }
        } catch (parseError) {
          diagnostics.checks.package_json_parse_error = "Failed to parse package.json";
        }
      }
    }

    // Check 5: Does node_modules exist?
    const nodeModulesResult = await executeViaShell(`test -d "${repo_path}/node_modules" && echo "EXISTS" || echo "NOT_FOUND"`);
    diagnostics.checks.node_modules_exists = nodeModulesResult.stdout.trim() === "EXISTS";

    // Check 6: Check for lock files to determine package manager
    const lockFilesResult = await executeViaShell(`ls -1 "${repo_path}" 2>/dev/null | grep -E "^(package-lock|yarn\\.lock|pnpm-lock|bun\\.lock)" || echo "NONE"`);
    diagnostics.checks.lock_files = lockFilesResult.stdout.trim().split("\n").filter((f: string) => f && f !== "NONE");

    // Check 7: Check which package managers are available
    const pmCheckResult = await executeViaShell("which npm yarn pnpm bun 2>&1");
    diagnostics.checks.available_package_managers = pmCheckResult.stdout.trim();

    // Check 8: Run npm outdated using the execute endpoint (like the real check does)
    console.log("[Diagnose] Running npm outdated via execute endpoint...");
    try {
      const outdatedResult = await executeViaExecute("npm_check");
      diagnostics.checks.npm_check_success = outdatedResult.success;
      diagnostics.checks.npm_check_output = outdatedResult.output?.substring(0, 1000);
      diagnostics.checks.npm_check_error = outdatedResult.error;

      // Try to parse the output
      if (outdatedResult.output) {
        try {
          const parsed = JSON.parse(outdatedResult.output);
          diagnostics.checks.npm_outdated_parsed = parsed;
          diagnostics.checks.npm_outdated_count = Object.keys(parsed).length;
        } catch (parseError) {
          diagnostics.checks.npm_outdated_parse_error = "Failed to parse npm outdated output";
        }
      }
    } catch (error) {
      diagnostics.checks.npm_check_exception = error instanceof Error ? error.message : "Unknown error";
    }

    // Check 9: Also run npm outdated via shell to compare
    console.log("[Diagnose] Running npm outdated via shell for comparison...");
    const shellOutdatedResult = await executeViaShell(`cd "${repo_path}" && npm outdated --json --long 2>&1`);
    diagnostics.checks.shell_npm_outdated_exit_code = shellOutdatedResult.exit_code;
    diagnostics.checks.shell_npm_outdated_stdout = shellOutdatedResult.stdout?.substring(0, 1000);
    diagnostics.checks.shell_npm_outdated_stderr = shellOutdatedResult.stderr?.substring(0, 500);

    try {
      const parsed = JSON.parse(shellOutdatedResult.stdout || "{}");
      diagnostics.checks.shell_npm_outdated_count = Object.keys(parsed).length;
    } catch (parseError) {
      diagnostics.checks.shell_npm_outdated_parse_error = "Failed to parse shell npm outdated output";
    }

    console.log("[Diagnose] Diagnostics complete:", JSON.stringify(diagnostics, null, 2));

    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error("[Diagnose] Error:", error);
    return NextResponse.json(
      { error: "Failed to diagnose packages", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
