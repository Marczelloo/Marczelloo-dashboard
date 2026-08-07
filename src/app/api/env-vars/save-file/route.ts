import { NextResponse } from "next/server";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { getEnvFilePath, shellQuote } from "@/server/runner/safe-paths";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface RunnerResult {
  success?: boolean;
  stdout?: string;
  stderr?: string;
}

interface EnvVar {
  key: string;
  value: string;
}

async function runShell(command: string): Promise<{ response: Response; result: RunnerResult }> {
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

function validateVars(vars: unknown): vars is EnvVar[] {
  return (
    Array.isArray(vars) &&
    vars.every(
      (variable): variable is EnvVar =>
        Boolean(variable) &&
        typeof variable === "object" &&
        typeof (variable as EnvVar).key === "string" &&
        typeof (variable as EnvVar).value === "string" &&
        ENV_KEY_PATTERN.test((variable as EnvVar).key)
    )
  );
}

function runnerError(response: Response, result: RunnerResult): NextResponse {
  const detail = result.stderr || result.stdout || "Runner request failed";
  return NextResponse.json(
    { success: false, error: detail },
    { status: response.ok ? 502 : response.status }
  );
}

export async function POST(request: Request) {
  try {
    await requirePinVerification();

    const body = await request.json();
    const { repoPath, filename, vars, action } = body;
    const target = getEnvFilePath(repoPath, filename);

    if (!RUNNER_TOKEN) {
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    if (action === "append" && Array.isArray(vars) && vars.length === 1) {
      const [variable] = vars;
      if (!validateVars([variable])) {
        return NextResponse.json({ success: false, error: "Invalid env var key or value" }, { status: 400 });
      }

      const encodedLine = Buffer.from(`${variable.key}=${variable.value}\n`, "utf8").toString("base64");
      const tempFile = `${target.filePath}.tmp`;
      const command =
        `touch ${shellQuote(target.filePath)} && ` +
        `awk -v key=${shellQuote(variable.key)} 'index($0, key "=") == 1 { next } { print }' ${shellQuote(target.filePath)} > ${shellQuote(tempFile)} && ` +
        `printf '%s' ${shellQuote(encodedLine)} | base64 -d >> ${shellQuote(tempFile)} && ` +
        `mv -f ${shellQuote(tempFile)} ${shellQuote(target.filePath)}`;
      const { response, result } = await runShell(command);

      if (!response.ok || !result.success) return runnerError(response, result);

      return NextResponse.json({ success: true, action: "updated", key: variable.key, filePath: target.filePath });
    }

    if (action === "write" && Array.isArray(vars)) {
      if (!validateVars(vars)) {
        return NextResponse.json({ success: false, error: "Invalid env var key or value" }, { status: 400 });
      }

      const content = vars.map((variable) => `${variable.key}=${variable.value}`).join("\n") + (vars.length ? "\n" : "");
      const encodedContent = Buffer.from(content, "utf8").toString("base64");
      const tempFile = `${target.filePath}.tmp`;
      const command =
        `umask 077 && ` +
        `printf '%s' ${shellQuote(encodedContent)} | base64 -d > ${shellQuote(tempFile)} && ` +
        `mv -f ${shellQuote(tempFile)} ${shellQuote(target.filePath)}`;
      const { response, result } = await runShell(command);

      if (!response.ok || !result.success) return runnerError(response, result);

      return NextResponse.json({ success: true, action: "written", count: vars.length, filePath: target.filePath });
    }

    if (action === "delete" && Array.isArray(vars) && vars.length === 1) {
      const [variable] = vars;
      if (!variable || typeof variable.key !== "string" || !ENV_KEY_PATTERN.test(variable.key)) {
        return NextResponse.json({ success: false, error: "Invalid env var key" }, { status: 400 });
      }

      const tempFile = `${target.filePath}.tmp`;
      const command =
        `if [ -f ${shellQuote(target.filePath)} ]; then ` +
        `awk -v key=${shellQuote(variable.key)} 'index($0, key "=") == 1 { next } { print }' ${shellQuote(target.filePath)} > ${shellQuote(tempFile)} && ` +
        `mv -f ${shellQuote(tempFile)} ${shellQuote(target.filePath)}; ` +
        `fi`;
      const { response, result } = await runShell(command);

      if (!response.ok || !result.success) return runnerError(response, result);

      return NextResponse.json({ success: true, action: "deleted", key: variable.key, filePath: target.filePath });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use 'append', 'write', or 'delete'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Env Save] Error:", error);

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
      { success: false, error: error instanceof Error ? error.message : "Failed to save env file" },
      { status: 500 }
    );
  }
}
