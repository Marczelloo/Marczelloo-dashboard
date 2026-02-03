import { NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

interface EnvVar {
  key: string;
  value: string;
}

export async function POST(request: Request) {
  try {
    const { repoPath, filename, vars, action } = await request.json();

    console.log(`[Env Save] Request: repoPath=${repoPath}, filename=${filename}, action=${action}, vars count=${vars?.length}`);

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
      // Build the .env content
      const content = vars
        .map((v: EnvVar) => `${v.key}=${v.value}`)
        .join("\n");

      // Write to temp file first, then move (atomic operation)
      const tempFile = `${filePath}.tmp.${Date.now()}`;
      
      // Use printf to handle special characters better
      const response = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({
          command: `cat > "${tempFile}" << 'ENVEOF'
${content}
ENVEOF
mv "${tempFile}" "${filePath}"`,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.log("[Env Save] Runner error:", error);
        return NextResponse.json({ success: false, error: `Runner error: ${error}` }, { status: response.status });
      }

      const result = await response.json();
      console.log("[Env Save] Write result:", { success: result.success, stderr: result.stderr });

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.stderr || "Failed to write file",
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

    return NextResponse.json({ success: false, error: "Invalid action. Use 'append', 'write', or 'delete'" }, { status: 400 });
  } catch (error) {
    console.error("[Env Save] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save env file" },
      { status: 500 }
    );
  }
}
