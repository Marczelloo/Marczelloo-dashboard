import { describe, expect, it } from "vitest";
import {
  acknowledgeEvents,
  emptyState,
  enqueue,
  finishJob,
  MAX_RELEASES,
  nextJob,
  recordRelease,
  recoverAfterRestart,
  rollbackRelease,
  staleImages,
  startJob,
} from "./queue";
import type { AgentState, DeployTarget, Release } from "./types";

const target = (composeProject = "marczelloo-tools"): DeployTarget => ({
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject,
  repoPath: `/home/Marczelloo_pi/projects/${composeProject}`,
  githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
  branch: "main",
  composeFile: null,
  profiles: [],
  tunnel: null,
});
const sha = (char: string) => char.repeat(40);
const release = (char: string, image = `app:${char.repeat(12)}`): Release => ({ sha: sha(char), images: { app: image }, deployedAt: "2026-09-16T10:00:00.000Z" });
const input = (id: string, commit: string, composeProject?: string, kind: "deploy" | "rollback" | "apply-env" = "deploy") => ({
  id,
  kind,
  target: target(composeProject),
  sha: sha(commit),
  deployId: `d-${id}`,
  triggeredBy: "github-webhook",
});

describe("enqueue", () => {
  it("replaces a queued deploy of the same project and reports it as superseded", () => {
    let state = enqueue(emptyState(), input("j1", "a"), "t1").state;
    state = enqueue(state, input("j2", "b"), "t2").state;
    expect(state.jobs.map((job) => [job.id, job.status])).toEqual([
      ["j1", "superseded"],
      ["j2", "queued"],
    ]);
    expect(state.outbox).toEqual([expect.objectContaining({ id: "j1:finished", status: "superseded", deployId: "d-j1" })]);
    expect(state.jobs[0].error).toContain("bbbbbbb");
  });

  it("closes a request for the commit that is already being deployed", () => {
    let state = startJob(enqueue(emptyState(), input("j1", "a"), "t1").state, "j1", "t2");
    const result = enqueue(state, input("j2", "a"), "t3");
    state = result.state;
    expect(result.job).toMatchObject({ id: "j2", status: "superseded" });
    expect(result.job.error).toContain("j1");
    expect(nextJob(state)).toBeNull();
    expect(state.outbox.at(-1)).toMatchObject({ id: "j2:finished", status: "superseded", deployId: "d-j2" });
  });

  it("does not coalesce running jobs, rollbacks or other projects", () => {
    let state = enqueue(emptyState(), input("j1", "a"), "t1").state;
    state = startJob(state, "j1", "t2");
    state = enqueue(state, input("j2", "b"), "t3").state;
    state = enqueue(state, input("j3", "c", "atlas-hub"), "t4").state;
    state = enqueue(state, input("j4", "d", "marczelloo-tools", "rollback"), "t5").state;
    expect(state.jobs.map((job) => job.status)).toEqual(["running", "queued", "queued", "queued"]);
  });
});

describe("nextJob and startJob", () => {
  it("runs one job at a time in FIFO order", () => {
    let state = enqueue(emptyState(), input("j1", "a"), "t1").state;
    state = enqueue(state, input("j2", "b", "atlas-hub"), "t2").state;
    expect(nextJob(state)?.id).toBe("j1");
    state = startJob(state, "j1", "t3");
    expect(nextJob(state)).toBeNull();
    expect(state.outbox.at(-1)).toMatchObject({ id: "j1:started", type: "job.started", status: "running" });
  });
});

describe("finishJob", () => {
  it("records the release first, deduplicates and keeps the newest three", () => {
    const releases = [release("a"), release("b"), release("c")];
    expect(recordRelease(releases, release("b")).map((item) => item.sha[0])).toEqual(["b", "a", "c"]);
    expect(recordRelease(releases, release("d"))).toHaveLength(MAX_RELEASES);
  });

  it("finishes the job, stores the release and emits a finished event", () => {
    let state = enqueue(emptyState(), input("j1", "a"), "t1").state;
    state = startJob(state, "j1", "t2");
    state = finishJob(state, "j1", { status: "succeeded", error: null, rolledBackTo: null, release: release("a"), baseline: null, orphanImages: [] }, "t3");
    expect(state.jobs[0]).toMatchObject({ status: "succeeded", finishedAt: "t3" });
    expect(state.projects["marczelloo-tools"].releases.map((item) => item.sha)).toEqual([sha("a")]);
    expect(state.outbox.at(-1)).toMatchObject({ id: "j1:finished", status: "succeeded" });
  });

  it("records the live baseline before the new release", () => {
    let state = startJob(enqueue(emptyState(), input("j1", "b"), "t1").state, "j1", "t2");
    state = finishJob(state, "j1", { status: "succeeded", error: null, rolledBackTo: null, release: release("b"), baseline: release("a"), orphanImages: [] }, "t3");
    expect(state.projects["marczelloo-tools"].releases.map((item) => item.sha)).toEqual([sha("b"), sha("a")]);
  });

  it("keeps releases unchanged after a rollback", () => {
    let state: AgentState = { ...emptyState(), projects: { "marczelloo-tools": { releases: [release("a")] } } };
    state = startJob(enqueue(state, input("j1", "b"), "t1").state, "j1", "t2");
    state = finishJob(state, "j1", { status: "rolled_back", error: "unhealthy", rolledBackTo: sha("a"), release: null, baseline: null, orphanImages: [] }, "t3");
    expect(state.projects["marczelloo-tools"].releases.map((item) => item.sha)).toEqual([sha("a")]);
    expect(state.outbox.at(-1)).toMatchObject({ status: "rolled_back", rolledBackTo: sha("a"), error: "unhealthy" });
  });
});

describe("recovery and helpers", () => {
  it("fails jobs that were running when the agent stopped", () => {
    let state = startJob(enqueue(emptyState(), input("j1", "a", undefined, "apply-env"), "t1").state, "j1", "t2");
    state = recoverAfterRestart(state, "t3");
    expect(state.jobs[0]).toMatchObject({ status: "failed", finishedAt: "t3" });
    expect(state.jobs[0].error).toContain("zrestartowany");
    expect(state.outbox.at(-1)).toMatchObject({ id: "j1:finished", status: "failed" });
  });

  it("picks the previous release by default or an explicit one", () => {
    const state = { ...emptyState(), projects: { p: { releases: [release("a"), release("b")] } } };
    expect(rollbackRelease(state, "p")?.sha).toBe(sha("b"));
    expect(rollbackRelease(state, "p", sha("a"))?.sha).toBe(sha("a"));
    expect(rollbackRelease(state, "p", sha("c"))).toBeNull();
    expect(rollbackRelease(emptyState(), "p")).toBeNull();
  });

  it("lists images that no kept release uses", () => {
    expect(staleImages([release("a", "app:1"), release("b", "app:2")], [release("c", "app:3"), release("a", "app:1")])).toEqual(["app:2"]);
  });

  it("acknowledges delivered events", () => {
    const state = startJob(enqueue(emptyState(), input("j1", "a"), "t1").state, "j1", "t2");
    expect(acknowledgeEvents(state, ["j1:started"]).outbox).toEqual([]);
  });
});
