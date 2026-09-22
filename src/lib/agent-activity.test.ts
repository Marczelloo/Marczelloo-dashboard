import { describe, expect, it } from "vitest";
import { anyActive, changedProjects, shouldRefresh, type AgentActivity } from "./agent-activity";

const idle = { active: null, step: null, lastFinishedAt: "2026-09-22T10:00:00Z" };
const activity = (projects: AgentActivity["projects"]): AgentActivity => ({ projects, selfProject: "marczelloo-dashboard" });

describe("agent activity", () => {
  it("reports a job starting and finishing, not its steps", () => {
    const before = activity({ drive: idle, tools: idle });
    const started = activity({ drive: { active: "deploy", step: "Build", lastFinishedAt: idle.lastFinishedAt }, tools: idle });
    const nextStep = activity({ drive: { active: "deploy", step: "Start containers", lastFinishedAt: idle.lastFinishedAt }, tools: idle });
    const finished = activity({ drive: { active: null, step: null, lastFinishedAt: "2026-09-22T10:05:00Z" }, tools: idle });
    expect(changedProjects(before, started)).toEqual(["drive"]);
    expect(changedProjects(started, nextStep)).toEqual([]);
    expect(changedProjects(nextStep, finished)).toEqual(["drive"]);
    expect(changedProjects(null, finished)).toEqual([]);
  });

  it("leaves the dashboard's own deploy to the reload prompt", () => {
    const before = activity({ "marczelloo-dashboard": idle });
    const after = activity({ "marczelloo-dashboard": { active: "deploy", step: null, lastFinishedAt: idle.lastFinishedAt } });
    expect(shouldRefresh(before, after)).toBe(false);
    expect(anyActive(after)).toBe(true);
    expect(anyActive(before)).toBe(false);
  });
});
