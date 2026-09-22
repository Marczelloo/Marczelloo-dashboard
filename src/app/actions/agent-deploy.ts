"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Job, Release } from "@agent/types";
import type { ActionResult } from "@/app/actions/projects";
import { checkDemoModeBlocked, isDemoMode } from "@/lib/demo-mode";
import { getAgentProject, isAgentConfigured } from "@/server/agent/client";
import { queueAgentRollback } from "@/server/agent/deploy";
import { agentLogRef } from "@/server/agent/refs";
import { auditLogs, services } from "@/server/atlashub";
import { getDeploymentConfig } from "@/server/deployments/config";
import { AuthError, requireAuth, requirePinVerification } from "@/server/lib/auth";

type Result<T> = ActionResult<T> & { code?: string };
type Engine = "script" | "agent";

function failure(error: unknown): Result<never> {
  if (error instanceof AuthError) return { success: false, error: error.message, code: error.code };
  if (error instanceof z.ZodError) return { success: false, error: error.errors[0]?.message ?? "Invalid data." };
  return { success: false, error: error instanceof Error ? error.message : "The operation failed." };
}

export async function getDeployEngineAction(projectId: string): Promise<
  Result<{ managed: boolean; engine: Engine; agentConfigured: boolean; releases: Release[]; activeJob: Job | null; agentError: string | null }>
> {
  try {
    // The public demo has no deployment configs and its user is not an owner.
    if (isDemoMode()) {
      return { success: true, data: { managed: false, engine: "script", agentConfigured: false, releases: [], activeJob: null, agentError: null } };
    }
    await requireAuth();
    const config = await getDeploymentConfig(projectId);
    const agentConfigured = isAgentConfigured();
    if (!config) {
      return { success: true, data: { managed: false, engine: "script", agentConfigured, releases: [], activeJob: null, agentError: null } };
    }
    let releases: Release[] = [];
    let activeJob: Job | null = null;
    let agentError: string | null = null;
    if (agentConfigured && config.engine === "agent") {
      try {
        ({ releases, activeJob } = await getAgentProject(config.composeProject));
      } catch (error) {
        agentError = error instanceof Error ? error.message : "The agent is unavailable.";
      }
    }
    return { success: true, data: { managed: true, engine: config.engine ?? "script", agentConfigured, releases, activeJob, agentError } };
  } catch (error) {
    return failure(error);
  }
}

export async function rollbackProjectAction(projectId: string, sha?: string): Promise<Result<{ deployId: string; logFile: string }>> {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return demo.result;
    const user = await requirePinVerification();
    if (sha !== undefined && !/^[0-9a-f]{40}$/.test(sha)) return { success: false, error: "Invalid release SHA." };

    const config = await getDeploymentConfig(projectId);
    if (!config || config.engine !== "agent") return { success: false, error: "Rollback works only for projects the agent deploys." };
    const serviceRows = await services.getServicesByProjectId(projectId);
    const service = serviceRows.find((row) => row.compose_project === config.composeProject) ?? serviceRows.find((row) => row.type === "docker");
    if (!service) return { success: false, error: "The project has no Docker service yet. Deploy it first." };

    const queued = await queueAgentRollback({ config, serviceId: service.id, triggeredBy: user.email, sha });
    await auditLogs.logAction(user.email, "rollback", "project", projectId, { deploy_id: queued.deployId, job_id: queued.jobId, sha: queued.sha });
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { deployId: queued.deployId, logFile: agentLogRef(queued.jobId) } };
  } catch (error) {
    return failure(error);
  }
}
