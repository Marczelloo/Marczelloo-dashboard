import type { AgentEvent } from "@agent/types";
import type { DeployStatus } from "@/types";

export interface DeployUpdatePlan {
  status: DeployStatus;
  errorMessage: string | null;
  notify: "success" | "failed" | null;
}

export function planDeployUpdate(event: AgentEvent): DeployUpdatePlan {
  if (event.type === "job.started") return { status: "running", errorMessage: null, notify: null };
  switch (event.status) {
    case "succeeded":
      return { status: "success", errorMessage: null, notify: "success" };
    case "rolled_back":
      if (event.kind === "apply-env") {
        return { status: "failed", errorMessage: `New variables failed the health check; the previous file is back. ${event.error ?? ""}`.trim(), notify: "failed" };
      }
      return {
        status: "failed",
        errorMessage: `Health check failed; rolled back to ${event.rolledBackTo?.slice(0, 7) ?? "the previous version"}. ${event.error ?? ""}`.trim(),
        notify: "failed",
      };
    case "superseded":
      return { status: "cancelled", errorMessage: event.error, notify: null };
    default:
      return { status: "failed", errorMessage: event.error ?? "The deploy failed.", notify: "failed" };
  }
}
