import { describe, expect, it, vi } from "vitest";
import { emptyState, enqueue, setJobStep, startJob } from "./queue";
import { assembleAgentStatus, createStatusReader, parseDockerSize } from "./status";

describe("parseDockerSize", () => {
  it.each([
    ["0B", 0],
    ["512kB", 512_000],
    ["10.5MB", 10_500_000],
    ["1.23GB", 1_230_000_000],
    ["2TB", 2_000_000_000_000],
  ])("parses Docker decimal size %s", (value, expected) => {
    expect(parseDockerSize(value)).toBe(expected);
  });

  it("rejects unknown size formats", () => {
    expect(parseDockerSize("12GiB")).toBeNull();
  });
});

describe("createStatusReader", () => {
  it("uses one project listing and one inspect, and caches build cache size", async () => {
    const run = vi.fn(async (step: { args: string[] }) => {
      if (step.args[0] === "ps") return { code: 0, stdout: "id-a\nid-b\n", stderr: "" };
      if (step.args[0] === "inspect") return { code: 0, stdout: "[]", stderr: "" };
      return { code: 0, stdout: '{"Type":"Build Cache","Size":"1.23GB"}\n', stderr: "" };
    });
    const reader = createStatusReader("/projects", {
      run: run as never,
      statfs: vi.fn(async () => ({ blocks: 10, bsize: 100, bavail: 4 })) as never,
      now: () => new Date("2026-09-16T10:00:00.000Z"),
    });

    const first = await reader(emptyState());
    const second = await reader(emptyState());

    expect(first.disk).toEqual({ path: "/projects", totalBytes: 1000, freeBytes: 400 });
    expect(first.buildCacheBytes).toBe(1_230_000_000);
    expect(second.buildCacheBytes).toBe(1_230_000_000);
    expect(run.mock.calls.filter(([step]) => step.args[0] === "ps")).toHaveLength(2);
    expect(run.mock.calls.filter(([step]) => step.args[0] === "inspect")).toHaveLength(2);
    expect(run.mock.calls.filter(([step]) => step.args[0] === "system")).toHaveLength(1);
  });
});

describe("assembleAgentStatus", () => {
  it("exposes the active job's step, commit and start time", () => {
    const target = { projectId: "p", composeProject: "drive", repoPath: "/r", githubUrl: "https://github.com/x/y", branch: "main", composeFile: null, profiles: [], tunnel: null };
    let state = enqueue(emptyState(), { id: "j1", kind: "deploy", target, sha: "a".repeat(40), deployId: "d1", triggeredBy: "test" }, "t1").state;
    state = setJobStep(startJob(state, "j1", "2026-09-17T10:00:00.000Z"), "j1", "Build");
    const status = assembleAgentStatus(state, {}, null, null, "now");
    expect(status.projects.drive.activeJob).toEqual({ id: "j1", kind: "deploy", status: "running", step: "Build", sha: "a".repeat(40), startedAt: "2026-09-17T10:00:00.000Z" });
  });
});
