import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { emptyState } from "./queue";
import { createAgentServer, type ServerContext } from "./server";
import type { AgentState } from "./types";

const TOKEN = "t".repeat(40);
const JOB_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const SECOND_JOB_ID = "1f8fad5b-d9cb-469f-a165-70867728950e";
const target = {
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject: "marczelloo-tools",
  repoPath: "/home/Marczelloo_pi/projects/marczelloo-tools",
  githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
  branch: "main",
  composeFile: null,
  profiles: [],
  tunnel: { hostname: "tools.marczelloo.dev", localPort: 3202 },
};
const deploy = { kind: "deploy", target, sha: "b".repeat(40), deployId: "22222222-2222-4222-8222-222222222222", triggeredBy: "tester", token: "ghs_x" };
const applyEnv = { kind: "apply-env", target, deployId: deploy.deployId, triggeredBy: "tester", envFile: { name: ".env", content: "SECRET=value", previous: "SECRET=old" } };

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

async function start(initial: AgentState = emptyState()) {
  let state = initial;
  const tokens = new Map<string, string | null>();
  const envFiles = new Map();
  let ids = 0;
  const context: ServerContext = {
    token: TOKEN,
    allowedRoot: "/home/Marczelloo_pi/projects",
    getState: () => state,
    mutate: (change) => {
      state = change(state);
    },
    store: { readLog: () => ({ content: "log", nextOffset: 3 }) },
    tokens,
    envFiles,
    now: () => "2026-09-16T10:00:00.000Z",
    newId: () => (ids++ === 0 ? JOB_ID : SECOND_JOB_ID),
  };
  const server = createAgentServer(context);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  stop = () => server.close();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, init: RequestInit = {}, auth = true) =>
    fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${TOKEN}` } : {}) } });
  return { call, tokens, envFiles, state: () => state };
}

describe("agent HTTP API", () => {
  it("serves health without a token and rejects other calls without one", async () => {
    const { call } = await start();
    expect((await call("/health", {}, false)).status).toBe(200);
    expect((await call("/jobs", { method: "POST", body: JSON.stringify(deploy) }, false)).status).toBe(401);
  });

  it("queues a deploy and keeps the GitHub token only in memory", async () => {
    const { call, tokens, state } = await start();
    const response = await call("/jobs", { method: "POST", body: JSON.stringify(deploy) });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ id: JOB_ID, status: "queued", sha: "b".repeat(40) });
    expect(tokens.get(JOB_ID)).toBe("ghs_x");
    expect(JSON.stringify(state())).not.toContain("ghs_x");
  });

  it("validates requests and the projects directory", async () => {
    const { call } = await start();
    expect((await call("/jobs", { method: "POST", body: JSON.stringify({ ...deploy, sha: "abc" }) })).status).toBe(400);
    expect((await call("/jobs", { method: "POST", body: JSON.stringify({ ...deploy, target: { ...target, repoPath: "/etc/app" } }) })).status).toBe(400);
  });

  it("resolves rollbacks to a known release", async () => {
    const empty = await start();
    const rollback = { kind: "rollback", target, sha: null, deployId: deploy.deployId, triggeredBy: "tester" };
    expect((await empty.call("/jobs", { method: "POST", body: JSON.stringify(rollback) })).status).toBe(409);
    stop?.();

    const releases = [
      { sha: "b".repeat(40), images: { app: "x:b" }, deployedAt: "t2" },
      { sha: "a".repeat(40), images: { app: "x:a" }, deployedAt: "t1" },
    ];
    const withReleases = await start({ ...emptyState(), projects: { "marczelloo-tools": { releases } } });
    const response = await withReleases.call("/jobs", { method: "POST", body: JSON.stringify(rollback) });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ kind: "rollback", sha: "a".repeat(40) });
  });

  it("rejects apply-env when the project has no agent release", async () => {
    const { call } = await start();
    const response = await call("/jobs", { method: "POST", body: JSON.stringify(applyEnv) });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Projekt nie ma jeszcze wydania agenta — najpierw wykonaj deploy." });
  });

  it("keeps env contents in memory and does not supersede apply-env with a deploy", async () => {
    const releases = [{ sha: "a".repeat(40), images: { app: "x:a" }, deployedAt: "t" }];
    const { call, envFiles, state } = await start({ ...emptyState(), projects: { "marczelloo-tools": { releases } } });
    const created = await call("/jobs", { method: "POST", body: JSON.stringify(applyEnv) });
    expect(created.status).toBe(202);
    const createdJob = await created.json();
    expect(createdJob).toMatchObject({ id: JOB_ID, kind: "apply-env", sha: "a".repeat(40), status: "queued" });
    expect(createdJob).not.toHaveProperty("envFile");
    expect(JSON.stringify(state())).not.toContain("SECRET=value");
    expect(JSON.stringify(state())).not.toContain("SECRET=old");
    expect(envFiles.get(JOB_ID)).toEqual(applyEnv.envFile);

    const deployResponse = await call("/jobs", { method: "POST", body: JSON.stringify(deploy) });
    expect(deployResponse.status).toBe(202);
    expect(state().jobs.map((job) => [job.kind, job.status])).toEqual([
      ["apply-env", "queued"],
      ["deploy", "queued"],
    ]);
  });

  it("returns jobs, logs and project state", async () => {
    const { call } = await start();
    await call("/jobs", { method: "POST", body: JSON.stringify(deploy) });
    expect((await call(`/jobs/${JOB_ID}`)).status).toBe(200);
    expect(await (await call(`/jobs/${JOB_ID}/log?offset=0`)).json()).toEqual({ content: "log", nextOffset: 3 });
    expect((await call("/jobs/00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect(await (await call("/projects/marczelloo-tools")).json()).toMatchObject({ releases: [], activeJob: { id: JOB_ID } });
  });
});
