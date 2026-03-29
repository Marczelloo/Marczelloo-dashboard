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
      checks: {},
    };

    // Check 1: Does the directory exist?
    try {
      const dirResult = await fetch(`${runnerUrl}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          command: `test -d "${containerPath}" && echo "EXISTS" || echo "NOT_FOUND"`,
        }),
      });

      if (dirResult.ok) {
        const dirData = await dirResult.json();
        diagnostics.checks.directory_exists = dirData.stdout.trim() === "EXISTS";
      }
    } catch (error) {
      diagnostics.checks.directory_exists = false;
      diagnostics.checks.directory_error = error instanceof Error ? error.message : "Unknown error";
    }

    // Check 2: Does package.json exist?
    try {
      const packageJsonResult = await fetch(`${runnerUrl}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          command: `test -f "${containerPath}/package.json" && echo "EXISTS" || echo "NOT_FOUND"`,
        }),
      });

      if (packageJsonResult.ok) {
        const pjData = await packageJsonResult.json();
        diagnostics.checks.package_json_exists = pjData.stdout.trim() === "EXISTS";
      }
    } catch (error) {
      diagnostics.checks.package_json_exists = false;
    }

    // Check 3: Does node_modules exist?
    try {
      const nodeModulesResult = await fetch(`${runnerUrl}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          command: `test -d "${containerPath}/node_modules" && echo "EXISTS" || echo "NOT_FOUND"`,
        }),
      });

      if (nodeModulesResult.ok) {
        const nmData = await nodeModulesResult.json();
        diagnostics.checks.node_modules_exists = nmData.stdout.trim() === "EXISTS";
      }
    } catch (error) {
      diagnostics.checks.node_modules_exists = false;
    }

    // Check 4: Read package.json to see dependencies
    try {
      const catResult = await fetch(`${runnerUrl}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          command: `cat "${containerPath}/package.json"`,
        }),
      });

      if (catResult.ok) {
        const catData = await catResult.json();
        if (catData.exit_code === 0) {
          try {
            const packageJson = JSON.parse(catData.stdout);
            diagnostics.checks.dependencies_count = Object.keys(packageJson.dependencies || {}).length;
            diagnostics.checks.dev_dependencies_count = Object.keys(packageJson.devDependencies || {}).length;
            diagnostics.checks.package_name = packageJson.name;
          } catch (parseError) {
            diagnostics.checks.package_json_parse_error = "Failed to parse package.json";
          }
        }
      }
    } catch (error) {
      diagnostics.checks.package_json_read_error = error instanceof Error ? error.message : "Unknown error";
    }

    // Check 5: Run npm outdated with verbose flag
    try {
      const outdatedResult = await fetch(`${runnerUrl}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          command: `cd "${containerPath}" && npm outdated --json --long 2>&1`,
        }),
      });

      if (outdatedResult.ok) {
        const outdatedData = await outdatedResult.json();
        diagnostics.checks.npm_outdated_exit_code = outdatedData.exit_code;
        diagnostics.checks.npm_outdated_stdout = outdatedData.stdout;
        diagnostics.checks.npm_outdated_stderr = outdatedData.stderr;

        // Try to parse the JSON output
        try {
          const parsed = JSON.parse(outdatedData.stdout || "{}");
          diagnostics.checks.npm_outdated_parsed = parsed;
          diagnostics.checks.npm_outdated_count = Object.keys(parsed).length;
        } catch (parseError) {
          diagnostics.checks.npm_outdated_parse_error = "Failed to parse npm outdated output";
        }
      }
    } catch (error) {
      diagnostics.checks.npm_outdated_error = error instanceof Error ? error.message : "Unknown error";
    }

    // Check 6: Run npm list to see installed packages
    try {
      const listResult = await fetch(`${runnerUrl}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runnerToken}`,
        },
        body: JSON.stringify({
          command: `cd "${containerPath}" && npm list --json --depth=0 2>&1 | head -c 5000`,
        }),
      });

      if (listResult.ok) {
        const listData = await listResult.json();
        diagnostics.checks.npm_list_exit_code = listData.exit_code;
        diagnostics.checks.npm_list_stdout = listData.stdout?.substring(0, 1000); // Truncate
        diagnostics.checks.npm_list_stderr = listData.stderr?.substring(0, 500); // Truncate

        try {
          const parsed = JSON.parse(listData.stdout || "{}");
          diagnostics.checks.npm_list_dependencies_count = Object.keys(parsed.dependencies || {}).length;
        } catch (parseError) {
          diagnostics.checks.npm_list_parse_error = "Failed to parse npm list output";
        }
      }
    } catch (error) {
      diagnostics.checks.npm_list_error = error instanceof Error ? error.message : "Unknown error";
    }

    console.log("[Diagnose] Complete diagnostics:", JSON.stringify(diagnostics, null, 2));

    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error("[Diagnose] Error:", error);
    return NextResponse.json(
      { error: "Failed to diagnose packages", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
