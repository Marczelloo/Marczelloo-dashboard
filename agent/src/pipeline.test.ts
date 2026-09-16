import { describe, expect, it } from "vitest";
import type { CommandStep } from "./git";
import type { ContainerSample } from "./health";
import { runDeploy, runRollback, type PipelineDeps } from "./pipeline";
import type { Job, Release } from "./types";

const NEW = "b".repeat(40);
const OLD = "a".repeat(40);
const CONFIG = JSON.stringify({ services: { app: { build: { context: "." }, ports: [{ published: "3202", target: 3000, protocol: "tcp", host_ip: "127.0.0.1" }] } } });
const previous: Release = { sha: OLD, images: { app: "marczelloo-tools-app:aaaaaaaaaaaa" }, deployedAt: "2026-09-15T10:00:00.000Z" };
const healthy: ContainerSample = { name: "marczelloo-tools", service: "app", status: "running", exitCode: 0, restartCount: 0, health: null };
const crashed: ContainerSample = { ...healthy, status: "exited", exitCode: 1 };

function job(kind: "deploy" | "rollback", sha: string): Job {
  return {
    id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    kind,
    target: {
      projectId: "11111111-1111-4111-8111-111111111111",
      composeProject: "marczelloo-tools",
      repoPath: "/p/tools",
      githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
      branch: "main",
      composeFile: null,
      profiles: [],
      tunnel: { hostname: "tools.marczelloo.dev", localPort: 3202 },
    },
    sha,
    deployId: "22222222-2222-4222-8222-222222222222",
    triggeredBy: "test",
    status: "running",
    createdAt: "t",
    startedAt: "t",
    finishedAt: null,
    error: null,
    rolledBackTo: null,
  };
}

function harness(options: { failLabel?: string; dirty?: boolean; notGit?: boolean; samples?: ContainerSample[][]; probes?: Array<number | null> } = {}) {
  let clock = 0;
  const steps: CommandStep[] = [];
  const writes: Array<{ file: string; content: string }> = [];
  const logs: string[] = [];
  const samples = [...(options.samples ?? [])];
  const probes = [...(options.probes ?? [200])];
  const files = options.notGit ? ["/p/tools"] : ["/p/tools", "/p/tools/.git", "/p/tools/docker-compose.yml"];
  const deps: PipelineDeps = {
    run: async (step) => {
      steps.push(step);
      if (options.failLabel && step.label.startsWith(options.failLabel)) return { code: 1, stdout: "", stderr: "boom" };
      if (step.args.includes("--porcelain")) return { code: 0, stdout: options.dirty ? " M src/app.ts\n" : "", stderr: "" };
      if (step.args.includes("--format")) return { code: 0, stdout: CONFIG, stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    exists: (file) => files.includes(file),
    writeFile: (file, content) => {
      writes.push({ file, content });
    },
    sampleContainers: async () => samples.shift() ?? [healthy],
    probe: async () => (probes.length > 1 ? probes.shift()! : probes[0]),
    sleep: async (ms) => {
      clock += ms;
    },
    log: (line) => {
      logs.push(line);
    },
    now: () => clock,
    overrideDir: "/data/overrides",
    gate: { stableMs: 10, timeoutMs: 30, intervalMs: 5, probeTimeoutMs: 15 },
  };
  return { deps, steps, writes, logs };
}

const labels = (steps: CommandStep[]) => steps.map((step) => step.label);

describe("runDeploy", () => {
  it("builds the exact commit with SHA-tagged images and records the release", async () => {
    const { deps, steps, writes } = harness();
    const outcome = await runDeploy(job("deploy", NEW), "ghs_token", previous, deps);
    expect(labels(steps)).toEqual(["Sprawdzenie lokalnych zmian", "Git fetch bbbbbbb", "Git checkout bbbbbbb", "Compose config", "Walidacja Compose", "Build", "Uruchomienie"]);
    expect(steps[1].env?.GIT_CONFIG_VALUE_0).toBeDefined();
    expect(steps.find((step) => step.label === "Compose config")?.quiet).toBe(true);
    expect(writes).toEqual([{ file: "/data/overrides/marczelloo-tools.yml", content: 'services:\n  "app":\n    image: "marczelloo-tools-app:bbbbbbbbbbbb"\n' }]);
    expect(outcome).toMatchObject({ status: "succeeded", error: null, release: { sha: NEW, images: { app: "marczelloo-tools-app:bbbbbbbbbbbb" } }, orphanImages: [] });
  });

  it("leaves running containers untouched when the build fails", async () => {
    const { deps, steps } = harness({ failLabel: "Build" });
    const outcome = await runDeploy(job("deploy", NEW), null, previous, deps);
    expect(outcome).toMatchObject({ status: "failed", rolledBackTo: null });
    expect(outcome.error).toContain("Build: kod 1");
    expect(labels(steps)).not.toContain("Uruchomienie");
  });

  it("refuses to overwrite local changes or a directory that is not a Git checkout", async () => {
    const dirty = harness({ dirty: true });
    expect((await runDeploy(job("deploy", NEW), null, previous, dirty.deps)).error).toContain("lokalne zmiany");
    expect(dirty.steps).toHaveLength(1);
    const notGit = harness({ notGit: true });
    expect((await runDeploy(job("deploy", NEW), null, previous, notGit.deps)).error).toContain("nie jest repozytorium Git");
    expect(notGit.steps).toHaveLength(0);
  });

  it("rolls back to the previous release when the gate fails", async () => {
    const { deps, steps, writes } = harness({ samples: [[crashed]] });
    const outcome = await runDeploy(job("deploy", NEW), null, previous, deps);
    expect(outcome).toMatchObject({ status: "rolled_back", rolledBackTo: OLD, release: null, orphanImages: ["marczelloo-tools-app:bbbbbbbbbbbb"] });
    expect(outcome.error).toContain("kodem 1");
    expect(labels(steps).slice(-3)).toEqual(["Git checkout aaaaaaa", "Compose config", "Uruchomienie"]);
    expect(writes.at(-1)?.content).toContain("marczelloo-tools-app:aaaaaaaaaaaa");
  });

  it("fails without a previous release and keeps the new images", async () => {
    const { deps } = harness({ samples: [[crashed]] });
    const outcome = await runDeploy(job("deploy", NEW), null, null, deps);
    expect(outcome).toMatchObject({ status: "failed", orphanImages: [] });
    expect(outcome.error).toContain("Brak wcześniejszej wersji");
  });

  it("retries the public probe and reports a rollback that also fails", async () => {
    const retried = harness({ probes: [502, 200] });
    expect((await runDeploy(job("deploy", NEW), null, previous, retried.deps)).status).toBe("succeeded");
    expect(retried.logs).toContain("Sonda https://tools.marczelloo.dev/: 502");

    const down = harness({ probes: [503] });
    const outcome = await runDeploy(job("deploy", NEW), null, previous, down.deps);
    expect(outcome.status).toBe("failed");
    expect(outcome.error).toContain("nie odpowiada");
    expect(outcome.error).toContain("nie przeszedł bramki");
  });
});

describe("runRollback", () => {
  it("restores a release without building", async () => {
    const { deps, steps } = harness();
    const outcome = await runRollback(job("rollback", OLD), previous, deps);
    expect(labels(steps)).toEqual(["Git checkout aaaaaaa", "Compose config", "Uruchomienie"]);
    expect(outcome).toMatchObject({ status: "succeeded", release: { sha: OLD, images: previous.images } });
  });
});
