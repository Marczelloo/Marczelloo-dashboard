import { describe, expect, it } from "vitest";
import { advance, incidentAction, notificationFor, shouldPersist } from "./state-machine";
import type { MonitorTarget, Observation, TargetState } from "./types";

const target: MonitorTarget = { key: "domain:a.dev", kind: "domain", label: "a.dev", projectId: "p1", composeProject: "a", host: "a.dev" };
const ok: Observation = { outcome: "ok", detail: { latencyMs: 10 } };
const fail: Observation = { outcome: "fail", reason: "HTTP 502", detail: { statusCode: 502 } };
const warn: Observation = { outcome: "warning", reason: "Certyfikat wygasa za 10 dni", detail: {} };
const t = (minute: number) => new Date(Date.UTC(2026, 8, 17, 12, minute)).toISOString();

function run(observations: Observation[], options: { muted?: boolean; start?: TargetState | null } = {}) {
  let state = options.start ?? null;
  const transitions = [];
  for (const [index, observation] of observations.entries()) {
    const result = advance(state, target, observation, t(index), { muted: options.muted ?? false });
    state = result.state;
    if (result.transition) transitions.push(result.transition);
  }
  return { state: state!, transitions };
}

describe("advance", () => {
  it("starts unknown targets as ok without a transition", () => {
    const { state, transitions } = run([ok]);
    expect(state).toMatchObject({ status: "ok", failCount: 0, since: t(0), lastCheckedAt: t(0), detail: { latencyMs: 10 } });
    expect(transitions).toEqual([]);
  });

  it("needs two consecutive failures before going down", () => {
    const first = run([ok, fail]);
    expect(first.state).toMatchObject({ status: "ok", failCount: 1, lastError: "HTTP 502" });
    expect(first.transitions).toEqual([]);

    const second = run([ok, fail, fail]);
    expect(second.state).toMatchObject({ status: "down", failCount: 2, since: t(2) });
    expect(second.transitions).toEqual([{ from: "ok", to: "down", reason: "HTTP 502", previousSince: t(0) }]);
  });

  it("resets the counter after a success", () => {
    expect(run([ok, fail, ok, fail]).state).toMatchObject({ status: "ok", failCount: 1 });
  });

  it("recovers from down with the outage start", () => {
    const { state, transitions } = run([fail, fail, fail, ok]);
    expect(state).toMatchObject({ status: "ok", failCount: 0, lastError: null, since: t(3) });
    expect(transitions.at(-1)).toEqual({ from: "down", to: "ok", reason: null, previousSince: t(1) });
    expect(transitions).toHaveLength(2);
  });

  it("goes to warning immediately and does not repeat the transition", () => {
    const { state, transitions } = run([ok, warn, warn]);
    expect(state).toMatchObject({ status: "warning", lastError: "Certyfikat wygasa za 10 dni" });
    expect(transitions).toEqual([{ from: "ok", to: "warning", reason: "Certyfikat wygasa za 10 dni", previousSince: t(0) }]);
  });

  it("uses a threshold of one for tls and disk", () => {
    const tls: MonitorTarget = { ...target, key: "tls:a.dev", kind: "tls" };
    const result = advance(null, tls, fail, t(0), { muted: false });
    expect(result.state.status).toBe("down");
    expect(result.transition).toMatchObject({ from: "unknown", to: "down" });
  });

  it("keeps status and counter while muted but records detail", () => {
    const start = run([ok, fail]).state;
    const { state, transitions } = run([fail, fail, fail], { muted: true, start });
    expect(state).toMatchObject({ status: "ok", failCount: 1, since: t(0), lastCheckedAt: t(2), detail: { statusCode: 502 } });
    expect(transitions).toEqual([]);
  });

  it("refreshes label and project from the target", () => {
    const start = run([ok]).state;
    const result = advance(start, { ...target, label: "renamed", projectId: "p2" }, ok, t(1), { muted: false });
    expect(result.state).toMatchObject({ label: "renamed", projectId: "p2" });
  });
});

describe("notificationFor", () => {
  it("describes an outage", () => {
    const payload = notificationFor(target, { from: "ok", to: "down", reason: "HTTP 502", previousSince: t(0) }, t(5), "Portfolio");
    expect(payload).toMatchObject({ color: "danger" });
    expect(payload?.title).toContain("a.dev");
    expect(payload?.fields).toEqual(expect.arrayContaining([{ name: "Projekt", value: "Portfolio", inline: true }, { name: "Przyczyna", value: "HTTP 502", inline: false }]));
  });

  it("includes the outage duration on recovery", () => {
    const payload = notificationFor(target, { from: "down", to: "ok", reason: null, previousSince: t(0) }, t(12), null);
    expect(payload).toMatchObject({ color: "success" });
    expect(payload?.fields).toEqual(expect.arrayContaining([{ name: "Czas trwania", value: "12 min", inline: true }]));
  });

  it("stays silent for the first successful check", () => {
    expect(notificationFor(target, { from: "unknown", to: "ok", reason: null, previousSince: t(0) }, t(1), null)).toBeNull();
  });
});

describe("incidentAction", () => {
  const tr = (from: TargetState["status"], to: TargetState["status"]) => ({ from, to, reason: null, previousSince: t(0) });
  it("opens, updates and closes incidents", () => {
    expect(incidentAction(tr("ok", "down"))).toBe("open");
    expect(incidentAction(tr("unknown", "warning"))).toBe("open");
    expect(incidentAction(tr("warning", "down"))).toBe("update");
    expect(incidentAction(tr("down", "ok"))).toBe("close");
    expect(incidentAction(tr("unknown", "ok"))).toBeNull();
  });
});

describe("shouldPersist", () => {
  const base = run([ok]).state;
  it("saves new targets, status changes and failure counts", () => {
    expect(shouldPersist(null, base, t(1))).toBe(true);
    expect(shouldPersist(base, { ...base, status: "down" }, t(1))).toBe(true);
    expect(shouldPersist(base, { ...base, failCount: 1, lastError: "HTTP 502" }, t(1))).toBe(true);
  });

  it("skips checks that only changed latency or free bytes", () => {
    expect(shouldPersist(base, { ...base, lastCheckedAt: t(1), detail: { latencyMs: 999 } }, t(1))).toBe(false);
    expect(shouldPersist({ ...base, detail: { freeBytes: 1, freePercent: 70 } }, { ...base, detail: { freeBytes: 2, freePercent: 70 } }, t(1))).toBe(false);
  });

  it("saves meaningful detail such as restart counters", () => {
    expect(shouldPersist({ ...base, detail: { restarts: { a: 1 } } }, { ...base, detail: { restarts: { a: 2 } } }, t(1))).toBe(true);
  });

  it("refreshes the stored check time every 15 minutes", () => {
    expect(shouldPersist(base, { ...base, lastCheckedAt: t(14) }, t(14))).toBe(false);
    expect(shouldPersist(base, { ...base, lastCheckedAt: t(15) }, t(15))).toBe(true);
  });
});
