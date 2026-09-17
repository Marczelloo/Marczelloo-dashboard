import { NextResponse } from "next/server";
import { AuthError, requireAuth, requirePinVerification } from "@/server/lib/auth";
import { getEnvFilePath, validateRepoPath } from "@/server/deployments/paths";
import { parseEnvEntries } from "@/server/env/dotenv";
import { listAgentEnvFiles, readAgentEnvFile } from "@/server/agent/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoPath, filename, action } = body;

    if (action === "list") {
      await requireAuth();
      const { files } = await listAgentEnvFiles(validateRepoPath(repoPath)).catch(() => ({ files: [] as string[] }));
      return NextResponse.json({ success: true, files });
    }

    await requirePinVerification();
    const target = getEnvFilePath(repoPath, filename);
    const file = await readAgentEnvFile(target.repoPath, target.filename);
    if (!file.exists) {
      return NextResponse.json({ success: false, error: `File not found: ${target.filePath}`, files: [] }, { status: 404 });
    }

    return NextResponse.json({ success: true, vars: parseEnvEntries(file.content), filePath: target.filePath });
  } catch (error) {
    console.error("[Env Load] Error:", error instanceof Error ? error.message : "unknown");

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
