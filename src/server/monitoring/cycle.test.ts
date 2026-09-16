import { describe, expect, it } from "vitest";
import type { AgentStatus, ProjectStatus } from "@agent/types";
import type { DeploymentConfig } from "@/server/deployments/config";
import { runMonitorCycle, type CycleDependencies, type StoredTargetState } from "./cycle";

const GB = 1_000_000_000;
const config = { projectId: "p-bot", composeProject: "mewbit", engine: "agent", tunnel: { enabled: true, hostname: "mewbit.dev", localPort: 3000 } } as DeploymentConfig;
const running = { name: "mewbit-bot-1", service: "bot", status: "running", exitCode: 0, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null };

function harness() {
  let minute = 0;
  let states: StoredTargetState[] = [];
  const incidents: Array<{ id: string; target_key: string; open: boolean; severity: string; reason: string | null; ended_at?: string }> = [];
  const notifications: string[] = [];
  const uptime: Array<{ service_id: string; ok: boolean }> = [];
  const world = {
    project: { containers: [running], activeJob: null, lastFinishedAt: null } as ProjectStatus,
    domainStatus: 200 as number | null,
    agentUp: true,
    serviceUrl: "https://mewbit.dev/" as string | null,
    ingress: [{ hostname: "mewbit.dev", service: "http://127.0.0.1:3000" }] as Array<{ hostname?: string; service: string }> | null,
  };
  let ids = 0;

  const deps: CycleDependencies = {
    now: () => new Date(Date.UTC(2026, 8, 17, 12, minute)),
    getAgentStatus: async () => {
      if (!world.agentUp) throw new Error("connect ECONNREFUSED");
      return { generatedAt: "x", projects: { mewbit: world.project }, disk: { path: "/p", totalBytes: 100 * GB, freeBytes: 60 * GB }, buildCacheBytes: 1 } satisfies AgentStatus;
    },
    listIngress: async () => world.ingress,
    listConfigs: async () => [config],
    listServices: async () => [{ id: "s1", project_id: "p-bot", url: world.serviceUrl }],
    listRoutes: async () => [],
    listProjectNames: async () => new Map([["p-bot", "MewBit"]]),
    listStates: async () => states.map((state) => ({ ...state })),
    saveState: async (state, id) => {
      if (id) states = states.map((current) => (current.id === id ? { ...state, id } : current));
      else states.push({ ...state, id: `s${ids++}` });
    },
    deleteState: async (id) => {
      states = states.filter((state) => state.id !== id);
    },
    listOpenIncidents: async () => incidents.filter((incident) => incident.open),
    openIncident: async (input) => {
      incidents.push({ id: `i${incidents.length}`, target_key: input.target_key, open: true, severity: input.severity, reason: input.reason });
    },
    updateIncident: async (id, values) => {
      Object.assign(incidents.find((incident) => incident.id === id)!, values);
    },
    probeDomain: async () => ({ statusCode: world.domainStatus, latencyMs: 20, error: world.domainStatus === null ? "timeout" : null }),
    probeTls: async () => ({ validTo: "2026-12-01T00:00:00Z", error: null }),
    notify: async (payload) => notifications.push(payload.title),
    recordUptime: async (input) => uptime.push({ service_id: input.service_id, ok: input.ok }),
  };

  const cycle = async (recordUptime = false) => {
    const result = await runMonitorCycle(deps, { recordUptime });
    minute += 1;
    return result;
  };
  return { world, cycle, notifications, incidents, uptime, states: () => states };
}

describe("runMonitorCycle", () => {
  it("records all targets on the first cycle without notifications", async () => {
    const h = harness();
    const result = await h.cycle(true);
    expect(result).toMatchObject({ checked: 5, muted: 0, transitions: 0, errors: [] });
    expect(h.states().map((state) => [state.key, state.status])).toEqual([
      ["agent", "ok"],
      ["disk", "ok"],
      ["containers:mewbit", "ok"],
      ["domain:mewbit.dev", "ok"],
      ["tls:mewbit.dev", "ok"],
    ]);
    expect(h.notifications).toEqual([]);
    expect(h.uptime).toEqual([{ service_id: "s1", ok: true }]);
  });

  it("does not rewrite unchanged states on every cycle", async () => {
    const h = harness();
    expect((await h.cycle()).saved).toBe(5);
    expect((await h.cycle()).saved).toBe(0);
  });

  it("alerts once for a crashing bot and once when it recovers", async () => {
    const h = harness();
    await h.cycle();
    h.world.project = { ...h.world.project, containers: [{ ...running, status: "restarting", restartCount: 3 }] };
    await h.cycle();
    expect(h.notifications).toEqual([]);
    await h.cycle();
    await h.cycle();
    expect(h.notifications).toEqual(["🔴 Kontenery mewbit: awaria"]);
    expect(h.incidents).toMatchObject([{ target_key: "containers:mewbit", open: true, severity: "down" }]);

    h.world.project = { ...h.world.project, containers: [{ ...running, restartCount: 3 }] };
    await h.cycle();
    expect(h.notifications).toEqual(["🔴 Kontenery mewbit: awaria", "✅ Kontenery mewbit: znowu działa"]);
    expect(h.incidents[0]).toMatchObject({ open: false });
  });

  it("stays silent while the project is being deployed", async () => {
    const h = harness();
    await h.cycle();
    h.world.project = { containers: [], activeJob: { id: "j", kind: "deploy", status: "running" }, lastFinishedAt: null };
    h.world.domainStatus = 502;
    const result = await h.cycle();
    await h.cycle();
    await h.cycle();
    expect(result.muted).toBe(2);
    expect(h.notifications).toEqual([]);
  });

  it("does not report containers as down when the agent is unreachable", async () => {
    const h = harness();
    await h.cycle();
    h.world.agentUp = false;
    await h.cycle();
    await h.cycle();
    expect(h.notifications).toEqual(["🔴 Agent wdrożeń: awaria"]);
    expect(h.states().find((state) => state.key === "containers:mewbit")?.status).toBe("ok");
  });

  it("keeps domains when Cloudflare is unavailable and removes them when the route is deleted", async () => {
    const h = harness();
    await h.cycle();
    h.world.ingress = null;
    await h.cycle();
    expect(h.states().some((state) => state.key === "domain:mewbit.dev")).toBe(true);
    h.world.ingress = [];
    await h.cycle();
    expect(h.states().some((state) => state.key === "domain:mewbit.dev")).toBe(true);
    h.world.serviceUrl = null;
    await h.cycle();
    expect(h.states().some((state) => state.key.includes("mewbit.dev"))).toBe(false);
  });
});
