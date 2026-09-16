import "server-only";

import type { AgentEvent } from "@agent/types";
import { auditLogs, deploys, projects } from "@/server/atlashub";
import { getDeploymentConfig } from "@/server/deployments/config";
import { updateCloudflareTunnelRoute } from "@/server/deployments/host";
import { notifyDeployFailed, notifyDeploySuccess } from "@/server/notifications";
import { planDeployUpdate } from "./event-plan";

const FINAL = new Set(["success", "failed", "cancelled"]);

export async function handleAgentEvent(event: AgentEvent): Promise<void> {
  const current = await deploys.getDeployById(event.deployId);
  if (!current) return;

  const plan = planDeployUpdate(event);
  // The deploy status is written last: a redelivered event whose status is
  // already recorded had all of its side effects applied.
  if (current.status === plan.status) return;
  if (FINAL.has(current.status) && plan.status === "running") return;

  if (event.type === "job.finished") {
    if (event.status === "succeeded") {
      // The route may still point at the previous port; switch it only now that the new version is healthy.
      const config = await getDeploymentConfig(event.projectId);
      if (config?.engine === "agent" && config.tunnel?.enabled) {
        await updateCloudflareTunnelRoute({ hostname: config.tunnel.hostname, localPort: config.tunnel.localPort });
      }
    }

    const project = await projects.getProjectById(event.projectId);
    const name = project?.name ?? event.composeProject;
    if (plan.notify === "success") await notifyDeploySuccess(name, event.sha.slice(0, 7));
    if (plan.notify === "failed") await notifyDeployFailed(name, plan.errorMessage ?? "Nieznany błąd");

    await auditLogs.logAction("deploy-agent", event.kind === "rollback" ? "rollback" : "deploy", "project", event.projectId, {
      job_id: event.jobId,
      deploy_id: event.deployId,
      sha: event.sha,
      status: event.status,
      rolled_back_to: event.rolledBackTo,
      error: event.error,
    });
  }

  await deploys.updateDeployStatus(event.deployId, plan.status, {
    commit_sha: event.sha,
    ...(plan.errorMessage ? { error_message: plan.errorMessage } : {}),
  });
}
