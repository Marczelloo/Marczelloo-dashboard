import { NextResponse } from "next/server";
import { AuthError, requireAuth, requirePinVerification } from "@/server/lib/auth";
import { getEnvFilePath, shellQuote } from "@/server/runner/safe-paths";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

interface RunnerResult {
  success?: boolean;
  stdout?: string;
  stderr?: string;
}

async function callRunner(command: string): Promise<{ response: Response; result: RunnerResult }> {
  const response = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_TOKEN}`,
    },
    body: JSON.stringify({ command }),
  });

  const result = (await response.json().catch(() => ({}))) as RunnerResult;
  return { response, result };
}

function parseEnv(content: string): { key: string; value: string }[] {
  const vars: { key: string; value: string }[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim().replace(/^export\s+/, "");
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      vars.push({ key, value });
    }
  }

  return vars;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoPath, filename, action } = body;
    if (action === "list") {
      await requireAuth();
    } else {
      await requirePinVerification();
    }
    const target = getEnvFilePath(repoPath, filename);

    if (!RUNNER_TOKEN) {
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    if (action === "list") {
      const { response, result } = await callRunner(
        `if [ -d ${shellQuote(target.repoPath)} ]; then ls -1a ${shellQuote(target.repoPath)}/.env* 2>/dev/null | sed 's#^.*/##'; fi`
      );

      if (!response.ok || !result.success) {
        return NextResponse.json({ success: true, files: [] });
      }

      const files = String(result.stdout || "")
        .split("\n")
        .map((file) => file.trim())
        .filter((file) => /^\.env(?:\.[A-Za-z0-9_-]+)?$/.test(file));

      return NextResponse.json({ success: true, files });
    }

    const { filePath } = target;
    const { response, result } = await callRunner(
      `if [ -f ${shellQuote(filePath)} ]; then cat ${shellQuote(filePath)}; else exit 44; fi`
    );

    if (!response.ok) {
      return NextResponse.json({ success: false, error: "Runner request failed" }, { status: response.status });
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: `File not found: ${filePath}`, files: [] }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      vars: parseEnv(String(result.stdout || "")),
      filePath,
    });
  } catch (error) {
    console.error("[Env Load] Error:", error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" },
        { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 }
      );
    }

    if (error instanceof Error && (error.message.includes("repoPath") || error.message.includes("filename"))) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load env file" },
      { status: 500 }
    );
  }
}
