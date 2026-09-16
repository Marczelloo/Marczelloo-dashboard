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
      return {
        status: "failed",
        errorMessage: `Bramka zdrowia nie przeszła — przywrócono ${event.rolledBackTo?.slice(0, 7) ?? "poprzednią wersję"}. ${event.error ?? ""}`.trim(),
        notify: "failed",
      };
    case "superseded":
      return { status: "cancelled", errorMessage: event.error, notify: null };
    default:
      return { status: "failed", errorMessage: event.error ?? "Wdrożenie nie powiodło się.", notify: "failed" };
  }
}
