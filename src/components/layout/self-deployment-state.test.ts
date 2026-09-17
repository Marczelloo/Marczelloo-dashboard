import { describe, expect, it } from "vitest";
import { selfDeployState } from "./self-deployment-state";

const job = { jobId: "j1", kind: "deploy", logFile: "agent:j1" };

describe("selfDeployState", () => {
  it("reports a running self deploy first", () => {
    expect(selfDeployState({ commit: "b", activeJob: job }, "a", null)).toBe("deploying");
  });

  it("offers a reload when a different release is live", () => {
    expect(selfDeployState({ commit: "b", activeJob: null }, "a", null)).toBe("new-version");
  });

  it("stays quiet when nothing changed, the page commit is unknown, or the release was dismissed", () => {
    expect(selfDeployState({ commit: "a", activeJob: null }, "a", null)).toBeNull();
    expect(selfDeployState({ commit: "b", activeJob: null }, null, null)).toBeNull();
    expect(selfDeployState({ commit: "b", activeJob: null }, "a", "b")).toBeNull();
    expect(selfDeployState(null, "a", null)).toBeNull();
  });
});
