import { describe, expect, it } from "vitest";
import { assembleOverview } from "./assemble";
import type { OverviewInputs } from "./types";

const now = new Date("2026-09-17T12:00:00.000Z");

const inputs = (): OverviewInputs => ({
  projects: [
    { id: "p1", name: "Drive", slug: "drive", status: "active", prod_url: "https://drive.marczelloo.dev" },
    { id: "p2", name: "Tools", slug: "tools", status: "active", prod_url: null },
    { id: "p3", name: "Old", slug: "old", status: "archived", prod_url: null },
  ] as never,
  services: [{ id: "s1", project_id: "p1", type: "docker", compose_project: "drive" }, { id: "s2", project_id: "p2", type: "docker", compose_project: null }] as never,
  configs: [{ projectId: "p2", composeProject: "tools", tunnel: { hostname: "tools.marczelloo.dev" } }] as never,
  states: [
    { key: "domain:drive.marczelloo.dev", kind: "domain", label: "drive.marczelloo.dev", projectId: "p1", status: "ok", failCount: 0, since: "s", lastCheckedAt: "2026-09-17T11:59:00.000Z", lastError: null, detail: {} },
    { key: "domain:tools.marczelloo.dev", kind: "domain", label: "tools.marczelloo.dev", projectId: "p2", status: "down", failCount: 2, since: "2026-09-17T11:40:00.000Z", lastCheckedAt: "2026-09-17T11:59:30.000Z", lastError: "502", detail: {} },
  ],
  incidents: [{ id: "i1", target_key: "domain:tools.marczelloo.dev", kind: "domain", label: "tools.marczelloo.dev", project_id: "p2", severity: "down", reason: "502", open: true, started_at: "2026-09-17T11:40:00.000Z", ended_at: null }],
  deploys: [
    { id: "d1", service_id: "s1", started_at: "2026-09-17T11:00:00.000Z", finished_at: "x", status: "success", commit_sha: "abc1234", logs_object_key: null, triggered_by: "me", error_message: null },
    { id: "d0", service_id: "s1", started_at: "2026-09-01T11:00:00.000Z", finished_at: "x", status: "failed", commit_sha: "old", logs_object_key: null, triggered_by: "me", error_message: null },
  ] as never,
  audit: [],
  todos: [],
  workItems: [],
  agent: {
    generatedAt: "now",
    projects: { drive: { containers: [{ name: "drive-web-1", service: "web", status: "running", exitCode: 0, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null }], activeJob: { id: "j", kind: "deploy", status: "running", step: "Build", sha: "def5678", startedAt: "t" }, lastFinishedAt: null } },
    disk: null,
    buildCacheBytes: null,
  },
  host: { hostname: "raspberrypi", cpu: { usage: 23 } as never, memory: { usagePercent: 61 } as never, disk: { usagePercent: 48 } as never, temperature: 52 },
});

describe("assembleOverview", () => {
  it("summarises domains, incidents, deploys and host", () => {
    const overview = assembleOverview(inputs(), now);
    expect(overview.domains).toEqual({ up: 1, total: 2, checkedAt: "2026-09-17T11:59:30.000Z" });
    expect(overview.incidents).toEqual({ open: 1, newest: { label: "tools.marczelloo.dev", since: "2026-09-17T11:40:00.000Z" } });
    expect(overview.deploys7d).toEqual({ total: 1, failed: 0 });
    expect(overview.host).toEqual({ hostname: "raspberrypi", cpu: 23, memory: 61, disk: 48, temperature: 52 });
  });

  it("builds ranked fleet rows without archived projects", () => {
    const fleet = assembleOverview(inputs(), now).fleet;
    expect(fleet.map((row) => [row.name, row.tone, row.attention?.kind ?? null])).toEqual([
      ["Drive", "live", "deploying"],
      ["Tools", "err", "down"],
    ]);
    expect(fleet[0]).toMatchObject({ domain: "drive.marczelloo.dev", composeProject: "drive", serviceId: "s1", containers: { running: 1, total: 1 }, lastDeploy: { at: "2026-09-17T11:00:00.000Z", sha: "abc1234", status: "success" } });
    expect(fleet[1]).toMatchObject({ domain: "tools.marczelloo.dev", composeProject: "tools", serviceId: "s2", containers: null });
    expect(fleet[1].uptime.at(-1)?.state).toBe("down");
  });
});
