import { describe, expect, it } from "vitest";
import type { ContainerStatus } from "@agent/types";
import { evaluateContainers, evaluateDisk, evaluateDomain, evaluateTls } from "./evaluate";

const container = (patch: Partial<ContainerStatus> = {}): ContainerStatus => ({
  name: "app-web-1",
  service: "web",
  status: "running",
  exitCode: 0,
  restartCount: 0,
  health: null,
  oomKilled: false,
  startedAt: "2026-09-17T10:00:00Z",
  finishedAt: null,
  ...patch,
});

describe("evaluateDomain", () => {
  it("treats redirects and client errors as reachable", () => {
    expect(evaluateDomain({ statusCode: 302, latencyMs: 40, error: null })).toEqual({ outcome: "ok", detail: { statusCode: 302, latencyMs: 40 } });
    expect(evaluateDomain({ statusCode: 404, latencyMs: 40, error: null }).outcome).toBe("ok");
  });

  it("fails on server errors, Cloudflare origin errors and network errors", () => {
    expect(evaluateDomain({ statusCode: 502, latencyMs: 40, error: null })).toMatchObject({ outcome: "fail", reason: "HTTP 502" });
    expect(evaluateDomain({ statusCode: 530, latencyMs: 40, error: null })).toMatchObject({ outcome: "fail", reason: "HTTP 530 (Cloudflare nie łączy się z Pi)" });
    expect(evaluateDomain({ statusCode: null, latencyMs: 10000, error: "timeout" })).toMatchObject({ outcome: "fail", reason: "timeout" });
  });
});

describe("evaluateContainers", () => {
  it("passes healthy containers and records restart baselines", () => {
    expect(evaluateContainers([container({ restartCount: 3 })], undefined)).toEqual({
      outcome: "ok",
      detail: { restarts: { "app-web-1": 3 }, containers: [{ name: "app-web-1", status: "running", health: null, restartCount: 3 }] },
    });
  });

  it("fails without containers", () => {
    expect(evaluateContainers([], undefined)).toMatchObject({ outcome: "fail", reason: "Projekt nie ma żadnych kontenerów." });
  });

  it("ignores containers that exited cleanly", () => {
    expect(evaluateContainers([container(), container({ name: "app-migrate-1", status: "exited", exitCode: 0 })], undefined).outcome).toBe("ok");
  });

  it.each([
    [container({ status: "exited", exitCode: 137 }), "app-web-1 zakończył działanie z kodem 137"],
    [container({ status: "restarting" }), "app-web-1 jest w stanie restarting"],
    [container({ status: "dead" }), "app-web-1 jest w stanie dead"],
    [container({ health: "unhealthy" }), "app-web-1 zgłasza unhealthy"],
    [container({ status: "exited", exitCode: 137, oomKilled: true }), "app-web-1 zabity przez brak pamięci (OOM)"],
  ])("fails for %o", (sample, reason) => {
    expect(evaluateContainers([sample], undefined)).toMatchObject({ outcome: "fail", reason });
  });

  it("fails when the restart counter grew since the previous check", () => {
    expect(evaluateContainers([container({ restartCount: 5 })], { "app-web-1": 4 })).toMatchObject({ outcome: "fail", reason: "app-web-1 zrestartował się (1× od ostatniego sprawdzenia)" });
    expect(evaluateContainers([container({ name: "app-web-2", restartCount: 5 })], { "app-web-1": 1 }).outcome).toBe("ok");
  });

  it("lists every problem in one reason", () => {
    const result = evaluateContainers([container({ status: "restarting" }), container({ name: "app-bot-1", health: "unhealthy" })], undefined);
    expect(result).toMatchObject({ outcome: "fail", reason: "app-web-1 jest w stanie restarting; app-bot-1 zgłasza unhealthy" });
  });
});

describe("evaluateTls", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  it("classifies by days left", () => {
    expect(evaluateTls({ validTo: "2026-11-17T12:00:00Z", error: null }, now)).toEqual({ outcome: "ok", detail: { daysLeft: 61, validTo: "2026-11-17T12:00:00.000Z" } });
    expect(evaluateTls({ validTo: "2026-09-27T12:00:00Z", error: null }, now)).toMatchObject({ outcome: "warning", reason: "Certyfikat wygasa za 10 dni" });
    expect(evaluateTls({ validTo: "2026-09-19T12:00:00Z", error: null }, now)).toMatchObject({ outcome: "fail", reason: "Certyfikat wygasa za 2 dni" });
    expect(evaluateTls({ validTo: "2026-09-10T12:00:00Z", error: null }, now)).toMatchObject({ outcome: "fail", reason: "Certyfikat wygasł" });
  });

  it("fails when the handshake fails", () => {
    expect(evaluateTls({ validTo: null, error: "ECONNRESET" }, now)).toMatchObject({ outcome: "fail", reason: "Nie udało się sprawdzić certyfikatu: ECONNRESET" });
  });
});

describe("evaluateDisk", () => {
  const GB = 1_000_000_000;
  it("warns below 10% and fails below 5% free", () => {
    expect(evaluateDisk({ path: "/p", totalBytes: 100 * GB, freeBytes: 50 * GB }, 12 * GB)).toEqual({ outcome: "ok", detail: { totalBytes: 100 * GB, freeBytes: 50 * GB, freePercent: 50, buildCacheBytes: 12 * GB } });
    expect(evaluateDisk({ path: "/p", totalBytes: 100 * GB, freeBytes: 8 * GB }, null)).toMatchObject({ outcome: "warning", reason: "Wolne 8% dysku (8.0 GB)" });
    expect(evaluateDisk({ path: "/p", totalBytes: 100 * GB, freeBytes: 4 * GB }, null)).toMatchObject({ outcome: "fail", reason: "Wolne 4% dysku (4.0 GB)" });
  });
});
