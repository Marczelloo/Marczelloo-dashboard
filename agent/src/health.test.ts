import { describe, expect, it } from "vitest";
import { assessContainers, assessProbe, parseInspectSamples, type ContainerSample } from "./health";

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
