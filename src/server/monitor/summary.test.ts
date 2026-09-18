import { describe, expect, it } from "vitest";
import { groupByProject, sortTargets, type MonitorTargetRow } from "./summary";

const row = (overrides: Partial<MonitorTargetRow>): MonitorTargetRow => ({
  key: "domain:a",
  kind: "domain",
  label: "a.example.com",
  projectId: null,
  projectName: null,
  status: "ok",
  since: "2026-09-18T10:00:00Z",
  lastCheckedAt: "2026-09-18T10:00:00Z",
  lastError: null,
  latencyMs: null,
  sslDaysLeft: null,
  freePercent: null,
  containers: [],
  ...overrides,
});

describe("sortTargets", () => {
  it("puts failures first and healthy targets last", () => {
    const sorted = sortTargets([
      row({ label: "ok", status: "ok" }),
      row({ label: "warn", status: "warning" }),
      row({ label: "down", status: "down" }),
      row({ label: "unknown", status: "unknown" }),
    ]);
    expect(sorted.map((target) => target.label)).toEqual(["down", "warn", "unknown", "ok"]);
  });
});

describe("groupByProject", () => {
  it("groups by project name and leads with the group in the worst shape", () => {
    const groups = groupByProject([
      row({ label: "a", projectName: "Alpha", status: "ok" }),
      row({ label: "b", projectName: "Beta", status: "down" }),
      row({ label: "c", projectName: "Beta", status: "ok" }),
    ]);
    expect(groups.map((group) => group.name)).toEqual(["Beta", "Alpha"]);
    expect(groups[0].rows.map((target) => target.label)).toEqual(["b", "c"]);
  });

  it("keeps targets without a project in their own group", () => {
    const groups = groupByProject([row({ label: "a" })]);
    expect(groups[0].name).toBe("Without a project");
  });
});
