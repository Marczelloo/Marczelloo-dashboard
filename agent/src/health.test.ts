import { describe, expect, it } from "vitest";
import { assessContainers, assessProbe, parseInspectSamples, parseProjectStatuses, parseServiceImages, type ContainerSample } from "./health";

const options = { stableMs: 30_000, timeoutMs: 180_000 };
const sample = (overrides: Partial<ContainerSample> = {}): ContainerSample => ({ name: "app", service: "app", status: "running", exitCode: 0, restartCount: 0, health: null, ...overrides });

describe("parseInspectSamples", () => {
  it("maps inspect JSON and skips one-off containers", () => {
    const json = JSON.stringify([
      { Name: "/tools", RestartCount: 2, State: { Status: "running", ExitCode: 0, Health: { Status: "healthy" } }, Config: { Labels: { "com.docker.compose.service": "app" } } },
      { Name: "/tools-run-1", State: { Status: "exited", ExitCode: 1 }, Config: { Labels: { "com.docker.compose.oneoff": "True" } } },
    ]);
    expect(parseInspectSamples(json)).toEqual([{ name: "tools", service: "app", status: "running", exitCode: 0, restartCount: 2, health: "healthy" }]);
  });
});

describe("parseProjectStatuses", () => {
  it("groups by Compose project, skips one-offs and maps runtime state", () => {
    const zero = "0001-01-01T00:00:00Z";
    const json = JSON.stringify([
      {
        Name: "/z-worker",
        RestartCount: 3,
        State: { Status: "exited", ExitCode: 137, OOMKilled: true, StartedAt: "2026-09-16T09:00:00Z", FinishedAt: "2026-09-16T09:05:00Z" },
        Config: { Labels: { "com.docker.compose.project": "tools", "com.docker.compose.service": "worker" } },
      },
      {
        Name: "/a-app",
        State: { Status: "created", StartedAt: zero, FinishedAt: zero },
        Config: { Labels: { "com.docker.compose.project": "tools", "com.docker.compose.service": "app" } },
      },
      {
        Name: "/tools-run-1",
        State: { Status: "exited" },
        Config: { Labels: { "com.docker.compose.project": "tools", "com.docker.compose.oneoff": "True" } },
      },
      { Name: "/other", State: { Status: "running" }, Config: { Labels: { "com.docker.compose.project": "other" } } },
    ]);

    expect(parseProjectStatuses(json)).toEqual({
      tools: [
        { name: "a-app", service: "app", status: "created", exitCode: 0, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null },
        { name: "z-worker", service: "worker", status: "exited", exitCode: 137, restartCount: 3, health: null, oomKilled: true, startedAt: "2026-09-16T09:00:00Z", finishedAt: "2026-09-16T09:05:00Z" },
      ],
      other: [{ name: "other", service: "", status: "running", exitCode: 0, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null }],
    });
  });
});

describe("parseServiceImages", () => {
  it("maps running services to image IDs", () => {
    const json = JSON.stringify([
      { Name: "/tools", Image: "sha256:aaa", State: { Status: "running" }, Config: { Labels: { "com.docker.compose.service": "app" } } },
      { Name: "/boot", Image: "sha256:bbb", State: { Status: "exited" }, Config: { Labels: { "com.docker.compose.service": "bootstrap" } } },
      { Name: "/run", Image: "sha256:ccc", State: { Status: "running" }, Config: { Labels: { "com.docker.compose.service": "app", "com.docker.compose.oneoff": "True" } } },
    ]);
    expect(parseServiceImages(json)).toEqual({ app: "sha256:aaa" });
  });
});

describe("assessContainers", () => {
  it("waits until containers were stable long enough, then passes", () => {
    expect(assessContainers([[sample()]], 5_000, options)).toMatchObject({ state: "wait" });
    expect(assessContainers([[sample()], [sample()]], 30_000, options)).toEqual({ state: "pass" });
  });

  it("accepts init containers that exited successfully (Drive bootstrap)", () => {
    expect(assessContainers([[sample(), sample({ name: "bootstrap", status: "exited", exitCode: 0 })]], 30_000, options)).toEqual({ state: "pass" });
  });

  it("fails on crashes, restarts and unhealthy containers", () => {
    expect(assessContainers([[sample({ status: "exited", exitCode: 1 })]], 1_000, options)).toMatchObject({ state: "fail", reason: expect.stringContaining("kodem 1") });
    expect(assessContainers([[sample()], [sample({ restartCount: 1 })]], 10_000, options)).toMatchObject({ state: "fail", reason: expect.stringContaining("restartuje") });
    expect(assessContainers([[sample({ status: "restarting" })]], 1_000, options)).toMatchObject({ state: "fail" });
    expect(assessContainers([[sample({ health: "unhealthy" })]], 1_000, options)).toMatchObject({ state: "fail", reason: expect.stringContaining("unhealthy") });
    expect(assessContainers([[]], 1_000, options)).toMatchObject({ state: "fail" });
  });

  it("waits for a starting healthcheck until the timeout", () => {
    expect(assessContainers([[sample({ health: "starting" })]], 60_000, options)).toMatchObject({ state: "wait" });
    expect(assessContainers([[sample({ health: "starting" })]], 180_000, options)).toMatchObject({ state: "fail", reason: expect.stringContaining("gotowości") });
  });
});

describe("assessProbe", () => {
  it("retries server errors and missing answers, passes the rest", () => {
    for (const status of [null, 500, 502, 503, 504, 520, 530]) expect(assessProbe(status)).toBe("retry");
    for (const status of [200, 301, 302, 401, 403, 404]) expect(assessProbe(status)).toBe("pass");
  });
});
