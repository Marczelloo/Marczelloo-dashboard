import { NextRequest, NextResponse } from "next/server";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { queueAgentEnvApply, recordEnvFileVersion } from "@/server/agent/env-apply";
import { appImport, auditLogs } from "@/server/atlashub";
import { services } from "@/server/data";
import { getDeploymentConfig } from "@/server/deployments";
import { readAgentEnvFile } from "@/server/agent/client";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { getEnvFilePath } from "@/server/deployments/paths";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return NextResponse.json(demo.result, { status: 403 });
    const user = await requirePinVerification();
    const { id, version: versionParam } = await params;
    const version = Number(versionParam);
    if (!Number.isInteger(version) || version < 1) return NextResponse.json({ success: false, error: "Invalid version." }, { status: 400 });

    const service = await services.getServiceById(id);
    if (!service?.project_id) return NextResponse.json({ success: false, error: "Service not found." }, { status: 404 });
    const config = await getDeploymentConfig(service.project_id);
    if (config?.engine !== "agent") return NextResponse.json({ success: false, error: "Restoring a version works only for projects the agent deploys." }, { status: 400 });

    const payload = await appImport.getEnvVersionPayload(service.project_id, version);
    if (!payload) return NextResponse.json({ success: false, error: "Version not found." }, { status: 404 });
    if (payload.version !== 2) return NextResponse.json({ success: false, error: "An imported version cannot be restored as a file; it holds variables from several sources." }, { status: 400 });

    const target = getEnvFilePath(config.repoPath, payload.fileName);
    const current = (await readAgentEnvFile(target.repoPath, target.filename)).content;

    await recordEnvFileVersion({ projectId: config.projectId, fileName: target.filename, content: current, note: "Before the restore", createdBy: user.email });
    const restored = await recordEnvFileVersion({ projectId: config.projectId, fileName: target.filename, content: payload.content, note: `Restored version ${version}`, createdBy: user.email });
    const queued = await queueAgentEnvApply({ config, serviceId: id, triggeredBy: user.email, fileName: target.filename, content: payload.content, previous: current === "" ? null : current });
    await auditLogs.logAction(user.email, "rollback", "project", config.projectId, { env_file: target.filename, restored_version: version, env_version: restored, deploy_id: queued.deployId, job_id: queued.jobId });
    return NextResponse.json({ success: true, agent: { ...queued, version: restored } });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" }, { status: error.code === "NOT_AUTHENTICATED" ? 401 : 403 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not restore the version." }, { status: 500 });
  }
}
