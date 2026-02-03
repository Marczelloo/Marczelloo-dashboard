import { NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export async function POST(request: Request) {
  try {
    const { repoPath, filename, action } = await request.json();

    console.log(`[Env Load] Request: repoPath=${repoPath}, action=${action}, filename=${filename}`);

    if (!repoPath) {
      return NextResponse.json({ success: false, error: "repoPath is required" }, { status: 400 });
    }

    if (!RUNNER_TOKEN) {
      console.log("[Env Load] ERROR: Missing RUNNER_TOKEN");
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    // List available .env files
    async function listEnvFiles(): Promise<string[]> {
      console.log(`[Env Load] Listing files in ${repoPath}`);
      const listResponse = await fetch(`${RUNNER_URL}/shell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RUNNER_TOKEN}`,
        },
        body: JSON.stringify({
          command: `ls -la "${repoPath}" 2>/dev/null | grep -E "^\-.*\.env" | awk '{print $NF}' | sort 2>/dev/null || find "${repoPath}" -maxdepth 1 -name ".env*" -type f -exec basename {} \\; 2>/dev/null | sort`,
        }),
      });

      console.log(`[Env Load] List response status: ${listResponse.status}`);
      
      if (listResponse.ok) {
        const listResult = await listResponse.json();
        console.log(`[Env Load] List result:`, { 
          success: listResult.success,
          ssh_enabled: listResult.ssh_enabled,
          stdout: listResult.stdout?.substring(0, 200),
          stderr: listResult.stderr
        });
        
        const files = (listResult.stdout || "")
          .split("\n")
          .map((f: string) => f.trim())
          .filter((f: string) => f && f.startsWith(".env"));
        
        console.log(`[Env Load] Found files:`, files);
        return files;
      }
      
      const errorText = await listResponse.text();
      console.log(`[Env Load] List request failed:`, errorText);
      return [];
    }

    // If action is 'list', just return available files
    if (action === "list") {
      const files = await listEnvFiles();
      return NextResponse.json({ success: true, files });
    }

    // Read the .env file from the repo path
    const fileName = filename || ".env";
    const filePath = `${repoPath}/${fileName}`;
    
    console.log(`[Env Load] Reading file: ${filePath}`);

    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cat "${filePath}" 2>/dev/null || echo "__FILE_NOT_FOUND__"`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`[Env Load] Runner error:`, error);
      return NextResponse.json({ success: false, error: `Runner error: ${error}` }, { status: response.status });
    }

    const result = await response.json();
    console.log(`[Env Load] Cat result:`, {
      success: result.success,
      stdout_length: result.stdout?.length || 0,
      stderr: result.stderr
    });

    if (result.stdout?.includes("__FILE_NOT_FOUND__")) {
      return NextResponse.json({
        success: false,
        error: `File not found: ${filePath}`,
        files: [],
      });
    }

    // Parse the .env content
    const content = result.stdout || "";
    const lines = content.split("\n");
    const vars: { key: string; value: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (key) {
          vars.push({ key, value });
        }
      }
    }

    console.log(`[Env Load] Parsed ${vars.length} variables`);

    return NextResponse.json({
      success: true,
      vars,
      filePath,
    });
  } catch (error) {
    console.error("[Env Load] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load env file" },
      { status: 500 }
    );
  }
}
