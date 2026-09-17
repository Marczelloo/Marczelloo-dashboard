import { describe, expect, it } from "vitest";
import type { TargetState } from "@/server/monitoring/types";
import { attentionFor, rankFleet, toneFor } from "./fleet";
import type { FleetRow } from "./types";

const state = (partial: Partial<TargetState>): TargetState => ({
  key: "domain:x",
  kind: "domain",
  label: "x",
  projectId: "p",
  status: "ok",
  failCount: 0,
  since: "2026-09-17T12:00:00.000Z",
  lastCheckedAt: null,
  lastError: null,
  detail: {},
  ...partial,
});

const exited = { name: "mewbit-api-1", service: "api", status: "exited", exitCode: 137, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null };
const running = { ...exited, name: "mewbit-bot-1", service: "bot", status: "running", exitCode: 0 };

describe("attentionFor", () => {
  it("prefers an active deploy over any failure", () => {
    const attention = attentionFor({
      agent: { containers: [exited], activeJob: { id: "j", kind: "deploy", status: "running", step: "Build", sha: "abc", startedAt: "t" }, lastFinishedAt: null },
      states: [state({ status: "down", lastError: "502" })],
    });
    expect(attention).toEqual({ kind: "deploying", jobId: "j", phase: "build", startedAt: "t", sha: "abc" });
  });

  it("reports down before degraded, with the first stopped container", () => {
    const attention = attentionFor({
      agent: { containers: [running, exited], activeJob: null, lastFinishedAt: null },
      states: [state({ status: "warning", lastError: "slow" }), state({ key: "containers:mewbit", kind: "containers", status: "down", lastError: "api exited", since: "s" })],
    });
    expect(attention).toEqual({ kind: "down", reason: "api exited", since: "s", container: { name: "mewbit-api-1", service: "api", status: "exited", exitCode: 137 } });
  });

  it("reports degraded and returns null when healthy", () => {
    expect(attentionFor({ agent: null, states: [state({ status: "warning", lastError: null, since: "s" })] })).toEqual({ kind: "degraded", reason: "Degraded", since: "s", container: null });
    expect(attentionFor({ agent: { containers: [running], activeJob: null, lastFinishedAt: null }, states: [state({})] })).toBeNull();
  });
});

describe("toneFor", () => {
  it("maps attention to a tone", () => {
    expect(toneFor({ kind: "deploying", jobId: "j", phase: null, startedAt: null, sha: "a" }, true)).toBe("live");
    expect(toneFor({ kind: "down", reason: "", since: "", container: null }, true)).toBe("err");
    expect(toneFor({ kind: "degraded", reason: "", since: "", container: null }, true)).toBe("warn");
    expect(toneFor(null, true)).toBe("ok");
    expect(toneFor(null, false)).toBe("idle");
  });
});

describe("rankFleet", () => {
  const row = (name: string, attention: FleetRow["attention"]): FleetRow => ({
    projectId: name,
    name,
    slug: name,
    description: null,
    tags: [],
    services: 0,
    openTasks: 0,
    deploys7d: 0,
    domain: null,
    composeProject: null,
    serviceId: null,
    tone: "ok",
    uptime: [],
    containers: null,
    lastDeploy: null,
    attention,
  });

  it("orders deploying, down, degraded, then the rest by name", () => {
    const ranked = rankFleet([
      row("Tools", null),
      row("MewBit", { kind: "degraded", reason: "", since: "", container: null }),
      row("AtlasHub", null),
      row("Portfolio", { kind: "down", reason: "", since: "", container: null }),
      row("Drive", { kind: "deploying", jobId: "j", phase: null, startedAt: null, sha: "a" }),
    ]);
    expect(ranked.map((item) => item.name)).toEqual(["Drive", "Portfolio", "MewBit", "AtlasHub", "Tools"]);
  });
});
