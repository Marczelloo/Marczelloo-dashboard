import { describe, expect, it } from "vitest";
import { agentLogRef, parseAgentLogRef } from "./refs";

describe("agent log refs", () => {
  it("round-trips job ids and rejects other values", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(parseAgentLogRef(agentLogRef(id))).toBe(id);
    expect(parseAgentLogRef("/home/Marczelloo_pi/projects/.dashboard/deploy-logs/x.log")).toBeNull();
    expect(parseAgentLogRef("agent:../../etc")).toBeNull();
  });
});
