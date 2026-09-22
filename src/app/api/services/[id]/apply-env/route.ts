import { NextRequest, NextResponse } from "next/server";
import { auditLogs } from "@/server/atlashub";
import { services } from "@/server/data";
import { readAgentEnvFile } from "@/server/agent/client";
import { queueAgentEnvApply } from "@/server/agent/env-apply";
import { getDeploymentConfig } from "@/server/deployments";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { checkDemoModeBlocked } from "@/lib/demo-mode";

/** Recreates an agent project's containers with its current `.env` on the current release, behind the health gate. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return NextResponse.json(demo.result, { status: 403 });

    const user = await requirePinVerification();
    const { id } = await params;
    const service = await services.getServiceById(id);
    if (!service) return NextResponse.json({ success: false, error: "Service not found." }, { status: 404 });

    const config = service.project_id ? await getDeploymentConfig(service.project_id) : null;
    if (config?.engine !== "agent") {
      return NextResponse.json({ success: false, error: "Variables can only be applied to a project the agent deploys." }, { status: 400 });
    }

    const file = await readAgentEnvFile(config.repoPath, ".env");
    if (!file.exists || !file.content) return NextResponse.json({ success: false, error: "The project has no .env file to apply." }, { status: 404 });
    const queued = await queueAgentEnvApply({ config, serviceId: id, triggeredBy: user.email, fileName: ".env", content: file.content, previous: file.content });
    await auditLogs.logAction(user.email, "update", "service", id, { apply_env: true, engine: "agent", deploy_id: queued.deployId, job_id: queued.jobId });
    return NextResponse.json({ success: true, agent: queued });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" },
        { status: error.code === "NOT_AUTHENTICATED" ? 401 : 403 }
      );
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not apply the variables." }, { status: 500 });
  }
}
