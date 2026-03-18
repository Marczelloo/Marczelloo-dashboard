import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/lib/auth";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

interface EnvVar {
  key: string;
  value: string;
}

// Valid env var key pattern: starts with letter or underscore, followed by letters, digits, or underscores
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validateEnvKeys(vars: EnvVar[]): { valid: boolean; invalidKeys: string[] } {
  const invalidKeys: string[] = [];
  for (const v of vars) {
    if (!ENV_KEY_PATTERN.test(v.key)) {
      invalidKeys.push(v.key);
    }
  }
  return { valid: invalidKeys.length === 0, invalidKeys };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { repoPath, filename, vars, action } = await request.json();

    console.log(
      `[Env Save] Request: repoPath=${repoPath}, filename=${filename}, action=${action}, vars count=${vars?.length}`
    );

    if (!repoPath) {
      return NextResponse.json({ success: false, error: "repoPath is required" }, { status: 400 });
    }

    if (!RUNNER_TOKEN) {
      console.log("[Env Save] ERROR: Missing RUNNER_TOKEN");
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    const envFile = filename || ".env";
    const filePath = `${repoPath}/${envFile}`;

    // Action: append a single variable
    if (action === "append" && vars?.length === 1) {
      const { key, value } = vars[0] as EnvVar;

      // Validate env var key
      if (!ENV_KEY_PATTERN.test(key)) {
        return NextResponse.json(
          { success: false, error: `Invalid env var key: "${key}". Keys must start with a letter or underscore and contain only letters, digits, and underscores.` },
          { status: 400 }
        );
      }

      // Escape value for shell (use single quotes, escape existing single quotes)
      const escapedValue = value.replace(/'/g, "'\\''");

      // Check if key already exists
      const checkResponse = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({
          command: `grep -q "^${key}=" "${filePath}" 2>/dev/null && echo "EXISTS" || echo "NEW"`,
        }),
      });

      if (!checkResponse.ok) {
        return NextResponse.json({ success: false, error: "Failed to check existing vars" }, { status: 500 });
      }

      const checkResult = await checkResponse.json();
      const exists = checkResult.stdout?.includes("EXISTS");

      let command: string;
      if (exists) {
        // Update existing variable using sed
        command = `sed -i 's|^${key}=.*|${key}=${escapedValue}|' "${filePath}"`;
      } else {
        // Append new variable
        command = `echo '${key}=${escapedValue}' >> "${filePath}"`;
      }

      const response = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.log("[Env Save] Runner error:", error);
        return NextResponse.json({ success: false, error: `Runner error: ${error}` }, { status: response.status });
      }

      const result = await response.json();
      console.log("[Env Save] Append result:", { success: result.success, stderr: result.stderr });

      return NextResponse.json({
        success: result.success,
        action: exists ? "updated" : "added",
        key,
        filePath,
      });
    }

    // Action: write entire file
    if (action === "write" && Array.isArray(vars)) {
      // Validate env var keys
      const validation = validateEnvKeys(vars);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: `Invalid env var key(s): ${validation.invalidKeys.join(", ")}. Keys must start with a letter or underscore and contain only letters, digits, and underscores.` },
          { status: 400 }
        );
      }

      // Write by clearing the file first, then appending each line
      // This is more reliable than complex heredoc or base64 commands
      const tempFile = `${filePath}.tmp.${Date.now()}`;

      // Step 1: Create temp file with content
      const lines = vars.map((v: EnvVar) => {
        // Escape single quotes in the value for shell
        const escapedValue = v.value.replace(/'/g, "'\\''");
        return `${v.key}=${escapedValue}`;
      });

      // Build a script that writes each line
      const writeLines = lines.map((line) => `echo '${line}'`).join(" >> ");
      const script = `rm -f "${filePath}" && ${writeLines} >> "${filePath}"`;

      const response = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({
          command: script,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.log("[Env Save] Runner error:", error);
        return NextResponse.json({ success: false, error: `Runner error: ${error}` }, { status: response.status });
      }

      const result = await response.json();
      console.log("[Env Save] Write result:", { success: result.success, stderr: result.stderr, stdout: result.stdout?.substring(0, 200) });

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.stderr || result.stdout || "Failed to write file",
        });
      }

      return NextResponse.json({
        success: true,
        action: "written",
        count: vars.length,
        filePath,
      });
    }

    // Action: delete a variable
    if (action === "delete" && vars?.length === 1) {
      const { key } = vars[0] as EnvVar;

      const response = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({
          command: `sed -i '/^${key}=/d' "${filePath}"`,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ success: false, error: `Runner error: ${error}` }, { status: response.status });
      }

      const result = await response.json();
      return NextResponse.json({
        success: result.success,
        action: "deleted",
        key,
        filePath,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use 'append', 'write', or 'delete'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Env Save] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save env file" },
      { status: 500 }
    );
  }
}
