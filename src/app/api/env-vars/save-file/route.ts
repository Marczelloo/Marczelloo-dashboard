import { NextResponse } from "next/server";
import { findAgentProjectByRepoPath, queueAgentEnvApply, recordEnvFileVersion } from "@/server/agent/env-apply";
import { auditLogs } from "@/server/atlashub";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { getEnvFilePath, shellQuote } from "@/server/runner/safe-paths";
import { formatEnvValue, parseEnvEntries, updateEnvContent } from "@/server/env/dotenv";

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

async function readCurrentFile(filePath: string): Promise<string> {
  const { response, result } = await runShell(`if [ -f ${shellQuote(filePath)} ]; then cat ${shellQuote(filePath)}; fi`);
  if (!response.ok || !result.success) throw new Error(result.stderr || "Nie udało się odczytać pliku env.");
  return String(result.stdout || "");
}

async function writeFileAtomic(filePath: string, content: string) {
  const encoded = Buffer.from(content, "utf8").toString("base64");
  const tempFile = `${filePath}.tmp`;
  return runShell(
    `umask 077 && printf '%s' ${shellQuote(encoded)} | base64 -d > ${shellQuote(tempFile)} && mv -f ${shellQuote(tempFile)} ${shellQuote(filePath)}`
  );
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
    const user = await requirePinVerification();

    const body = await request.json();
    const { repoPath, filename, vars, action, serviceId } = body;
    const target = getEnvFilePath(repoPath, filename);

    if (!RUNNER_TOKEN) {
      return NextResponse.json({ success: false, error: "Runner not configured" }, { status: 500 });
    }

    if (["append", "write", "delete"].includes(action) && Array.isArray(vars)) {
      if (action === "delete") {
        const [variable] = vars;
        if (!variable || typeof variable.key !== "string" || !ENV_KEY_PATTERN.test(variable.key)) {
          return NextResponse.json({ success: false, error: "Nieprawidłowy klucz zmiennej." }, { status: 400 });
        }
      } else if (!validateVars(vars)) {
        return NextResponse.json({ success: false, error: "Nieprawidłowy klucz lub wartość zmiennej." }, { status: 400 });
      }
      if (action !== "write" && vars.length !== 1) {
        return NextResponse.json({ success: false, error: "Ta akcja przyjmuje dokładnie jedną zmienną." }, { status: 400 });
      }
      if (action !== "delete") vars.forEach((variable: EnvVar) => formatEnvValue(variable.value));

      const original = await readCurrentFile(target.filePath);
      const current = parseEnvEntries(original);
      const [single] = vars as EnvVar[];
      const next =
        action === "write"
          ? (vars as EnvVar[])
          : action === "append"
            ? [...current.filter((entry) => entry.key !== single.key), single]
            : current.filter((entry) => entry.key !== single.key);

      const content = updateEnvContent(original, next);

      const agentProject = await findAgentProjectByRepoPath(target.repoPath);
      if (agentProject) {
        if (content === original) {
          return NextResponse.json({ success: true, action, count: next.length, filePath: target.filePath, unchanged: true });
        }
        // History first: the previous file is kept as a version before the agent replaces it.
        await recordEnvFileVersion({ projectId: agentProject.projectId, fileName: target.filename, content: original, note: "Stan pliku przed zmianą", createdBy: user.email });
        const version = await recordEnvFileVersion({ projectId: agentProject.projectId, fileName: target.filename, content, note: "Zapis z edytora zmiennych", createdBy: user.email });
        const queued = await queueAgentEnvApply({
          config: agentProject,
          serviceId: typeof serviceId === "string" ? serviceId : null,
          triggeredBy: user.email,
          fileName: target.filename,
          content,
          previous: original === "" ? null : original,
        });
        await auditLogs.logAction(user.email, "update", "project", agentProject.projectId, { env_file: target.filename, env_version: version, deploy_id: queued.deployId, job_id: queued.jobId, keys: next.length });
        return NextResponse.json({ success: true, action, count: next.length, filePath: target.filePath, agent: { ...queued, version } });
      }

      const { response, result } = await writeFileAtomic(target.filePath, content);
      if (!response.ok || !result.success) return runnerError(response, result);

      return NextResponse.json({ success: true, action, count: next.length, filePath: target.filePath });
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

    if (error instanceof Error && error.message.includes("ręcznie")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
