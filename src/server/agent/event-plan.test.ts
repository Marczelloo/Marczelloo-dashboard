import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@agent/types";
import { planDeployUpdate } from "./event-plan";

const base: AgentEvent = {
  id: "j:finished",
  type: "job.finished",
  jobId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  deployId: "22222222-2222-4222-8222-222222222222",
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject: "marczelloo-tools",
  kind: "deploy",
  sha: "b".repeat(40),
  status: "succeeded",
  error: null,
  rolledBackTo: null,
  at: "t",
};

describe("planDeployUpdate", () => {
  it("maps job events to deploy statuses and notifications", () => {
    expect(planDeployUpdate({ ...base, type: "job.started", status: "running" })).toEqual({ status: "running", errorMessage: null, notify: null });
    expect(planDeployUpdate(base)).toEqual({ status: "success", errorMessage: null, notify: "success" });
    expect(planDeployUpdate({ ...base, status: "superseded", error: "Replaced" })).toEqual({ status: "cancelled", errorMessage: "Replaced", notify: null });
    expect(planDeployUpdate({ ...base, status: "failed", error: "Build: kod 1" })).toEqual({ status: "failed", errorMessage: "Build: kod 1", notify: "failed" });
  });

  it("explains a rollback in the error message", () => {
    const plan = planDeployUpdate({ ...base, status: "rolled_back", error: "Container is restarting.", rolledBackTo: "a".repeat(40) });
    expect(plan).toMatchObject({ status: "failed", notify: "failed" });
    expect(plan.errorMessage).toBe("Health check failed; rolled back to aaaaaaa. Container is restarting.");
  });

  it("explains restored env files", () => {
    const plan = planDeployUpdate({ ...base, kind: "apply-env", status: "rolled_back", error: "New variables did not pass the health check: unhealthy", rolledBackTo: "a".repeat(40) });
    expect(plan.errorMessage).toBe("New variables failed the health check; the previous file is back. New variables did not pass the health check: unhealthy");
  });
});
