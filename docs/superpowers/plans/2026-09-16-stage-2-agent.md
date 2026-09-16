# Etap 2 — agent wdrożeń z kolejką, bramką zdrowia i rollbackiem — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić skryptowy deploy (runner `/shell` + skrypt w tle + dokończenie przez przeglądarkę) trwałym agentem, który kolejkuje wdrożenia, buduje konkretny commit z obrazami tagowanymi SHA, sprawdza zdrowie aplikacji, sam wycofuje nieudane wdrożenie i sam raportuje wynik.

**Architecture:** Agent to osobny kontener (`marczelloo-agent`, własny projekt Compose, żeby deploy dashboardu go nie restartował) z gniazdem Dockera i katalogiem projektów zamontowanym pod tą samą ścieżką co na hoście. Kolejka i historia wydań są trwałe w pliku agenta (nie w AtlasHubie — deploy AtlasHuba wyłącza bazę). Agent wykonuje wyłącznie polecenia `git`/`docker` z tablicą argumentów (bez powłoki), wynik wysyła do dashboardu (`POST /api/agent/events`) z ponawianiem, a dashboard aktualizuje `deploys`, wysyła powiadomienia i zapisuje audit log. Projekt przechodzi na agenta przełącznikiem `engine: "agent"` w konfiguracji wdrożenia; pozostałe zostają na obecnym skrypcie.

**Tech Stack:** Node.js 20 (agent: `node:20-bookworm-slim`, `tsx`), TypeScript strict, zod 3, vitest, Next.js 16 (server actions, route handlers, SSE), Docker Engine 29.2 + Compose v5.0.2 (binaria z hosta), AtlasHub REST.

**Spec:** `docs/superpowers/specs/2026-09-15-deploy-platform-rebuild-design.md` (decyzje 5–7) oraz sekcje „Agent następca runnera”, „Weryfikacja” i „Pipeline jednego wdrożenia” raportu audytu.

**Wymaga ukończonych etapów 0 i 1** (`vitest`, bramka Access z `isPublicPath`, `DeploymentConfig` z portami na `127.0.0.1`).

## Global Constraints

- Node.js 20 w obrazie agenta; host Pi ma Node 18 — agent nie działa na hoście.
- Nazwy projektów Compose są niezmienne; agent zawsze używa `-p <composeProject>` z konfiguracji.
- Agent uruchamia procesy wyłącznie przez `spawn(command, args)` bez powłoki; dozwolone polecenia: `git`, `docker`.
- Procesy potomne dostają tylko `PATH`, `HOME` i zmienne kroku — nigdy środowiska agenta (Compose dałby im pierwszeństwo przed `.env` projektu).
- Wyjście poleceń zawierających wartości env (`docker compose config --format json`, `docker inspect`, `git status`) nie trafia do logu zadania (`quiet: true`).
- Token GitHub App trafia do procesu `git` tylko przez zmienne środowiskowe `GIT_CONFIG_*`; nigdy w argumentach, logu ani pliku stanu.
- Jedno zadanie naraz na całym Pi; nowszy push zastępuje zakolejkowane (jeszcze nieuruchomione) wdrożenie tego samego projektu.
- Tagi obrazów: `<repozytorium>:<pierwsze 12 znaków SHA>`; historia 3 udanych wydań na projekt.
- Bramka zdrowia: kontenery stabilne przez 30 s (bez restartów, bez wyjścia z kodem ≠ 0, healthcheck `healthy` w ciągu 180 s), a przy trasie tunelu sonda `https://<domena>/` zwraca status < 500 w ciągu 60 s.
- Tekst UI i komunikaty zadań po polsku; commity po angielsku (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- Operacje na Pi (token, obraz agenta, przełączenie projektu) wymagają zgody właściciela w chwili wykonania.

## Mapa plików

| Plik | Odpowiedzialność |
|---|---|
| `agent/package.json`, `agent/package-lock.json` | zależności agenta (`tsx`, `zod`) |
| `agent/src/types.ts` | model zadań, wydań i zdarzeń |
| `agent/src/queue.ts` (+test) | kolejka: łączenie pushy, start/koniec, historia wydań, odzyskiwanie |
| `agent/src/store.ts` (+test) | trwały stan (JSON, zapis atomowy) i logi zadań |
| `agent/src/git.ts` (+test) | kroki `git` dla konkretnego SHA z tokenem w env |
| `agent/src/compose.ts` (+test) | argumenty Compose, override z tagami SHA i portem `127.0.0.1` |
| `agent/src/health.ts` (+test) | ocena próbek kontenerów i sondy publicznej |
| `agent/src/pipeline.ts` (+test) | deploy i rollback z wstrzykiwanymi zależnościami |
| `agent/src/api.ts` | schematy zod żądań i zdarzeń (wspólne z dashboardem) |
| `agent/src/server.ts` (+test) | HTTP API agenta z tokenem |
| `agent/src/reporter.ts` (+test) | dostarczanie zdarzeń do dashboardu z zachowaniem kolejności |
| `agent/src/exec.ts`, `agent/src/docker.ts`, `agent/src/main.ts` | wykonanie procesów, próbki Dockera, pętle agenta |
| `agent/Dockerfile`, `agent/docker-compose.yml`, `agent/.gitignore`, `agent/.dockerignore` | obraz i stack agenta |
| `tsconfig.json`, `vitest.config.ts` | alias `@agent/*`, testy agenta |
| `src/server/agent/refs.ts` (+test) | referencja logu `agent:<jobId>` |
| `src/server/agent/target.ts` (+test) | `DeploymentConfig` → cel agenta |
| `src/server/agent/event-plan.ts` (+test) | zdarzenie agenta → aktualizacja `deploys` |
| `src/server/agent/client.ts` | klient HTTP agenta |
| `src/server/agent/handle-event.ts` | zapis wyniku, powiadomienia, audit |
| `src/server/agent/deploy.ts` | kolejkowanie deployu i rollbacku, odczyt logu |
| `src/server/agent/log-stream.ts` | SSE logu zadania agenta |
| `src/server/deployments/commit.ts` | SHA gałęzi z GitHuba |
| `src/app/api/agent/events/route.ts` | odbiór zdarzeń agenta |
| `src/app/actions/agent-deploy.ts` | akcje: silnik, stan wydań, rollback |
| `src/app/(dashboard)/projects/[id]/_components/project-deploy-engine.tsx` | karta „Silnik wdrożeń” |
| `docs/runbooks/2026-09-16-stage-2-agent.md` | uruchomienie agenta i pilotaż na Tools |

---

### Task 1: Szkielet agenta, model i kolejka

**Files:**
- Create: `agent/package.json`, `agent/.gitignore`, `agent/.dockerignore`
- Create: `agent/src/types.ts`
- Create: `agent/src/queue.ts`
- Test: `agent/src/queue.test.ts`
- Modify: `vitest.config.ts`, `tsconfig.json`

**Interfaces:**
- Produces (`types.ts`): `JobKind`, `JobStatus`, `DeployTarget`, `Job`, `Release`, `ProjectState`, `AgentEvent`, `AgentState` (treść poniżej).
- Produces (`queue.ts`):
  - `export const MAX_FINISHED_JOBS = 200`, `export const MAX_RELEASES = 3`
  - `export interface EnqueueInput { id: string; kind: JobKind; target: DeployTarget; sha: string; deployId: string; triggeredBy: string }`
  - `export interface JobOutcome { status: "succeeded" | "failed" | "rolled_back"; error: string | null; rolledBackTo: string | null; release: Release | null; orphanImages: string[] }`
  - `export function emptyState(): AgentState`
  - `export function enqueue(state: AgentState, input: EnqueueInput, now: string): { state: AgentState; job: Job }`
  - `export function nextJob(state: AgentState): Job | null`
  - `export function startJob(state: AgentState, jobId: string, now: string): AgentState`
  - `export function finishJob(state: AgentState, jobId: string, outcome: JobOutcome, now: string): AgentState`
  - `export function recordRelease(releases: Release[], release: Release): Release[]`
  - `export function recoverAfterRestart(state: AgentState, now: string): AgentState`
  - `export function rollbackRelease(state: AgentState, composeProject: string, sha?: string): Release | null`
  - `export function staleImages(before: Release[], after: Release[]): string[]`
  - `export function acknowledgeEvents(state: AgentState, ids: string[]): AgentState`

- [ ] **Step 1: Pliki pakietu**

`agent/package.json`:

```json
{
  "name": "marczelloo-agent",
  "version": "1.0.0",
  "private": true,
  "description": "Deploy agent: queue, SHA-pinned Compose deploys, health gate and rollback",
  "scripts": {
    "start": "tsx src/main.ts"
  },
  "dependencies": {
    "tsx": "^4.19.0",
    "zod": "^3.25.76"
  }
}
```

`agent/.gitignore`:

```
node_modules/
vendor/
.env
```

`agent/.dockerignore`:

```
node_modules
.env
src/**/*.test.ts
```

Run: `cd agent && npm install --no-audit --no-fund && cd ..`
Expected: powstaje `agent/package-lock.json`.

- [ ] **Step 2: Alias i testy agenta**

W `tsconfig.json` w `compilerOptions.paths` dopisz obok `"@/*"`:

```json
      "@agent/*": [
        "./agent/src/*"
      ]
```

W `vitest.config.ts` dopisz alias i ścieżkę testów:

```ts
      "@agent": fileURLToPath(new URL("./agent/src", import.meta.url)),
```

```ts
    include: ["src/**/*.test.ts", "runner/**/*.test.ts", "scripts/**/*.test.ts", "agent/src/**/*.test.ts"],
```

- [ ] **Step 3: `agent/src/types.ts`**

```ts
export type JobKind = "deploy" | "rollback";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "rolled_back" | "superseded";

export interface DeployTarget {
  projectId: string;
  composeProject: string;
  repoPath: string;
  githubUrl: string;
  branch: string;
  composeFile: string | null;
  profiles: string[];
  tunnel: { hostname: string; localPort: number } | null;
}

export interface Job {
  id: string;
  kind: JobKind;
  target: DeployTarget;
  /** deploy: commit to build; rollback: commit whose images are restored */
  sha: string;
  deployId: string;
  triggeredBy: string;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  rolledBackTo: string | null;
}

export interface Release {
  sha: string;
  /** Compose service name → image reference built for this commit */
  images: Record<string, string>;
  deployedAt: string;
}

export interface ProjectState {
  /** Newest first. */
  releases: Release[];
}

export interface AgentEvent {
  /** Deterministic (`<jobId>:started` / `<jobId>:finished`) so redelivery is idempotent. */
  id: string;
  type: "job.started" | "job.finished";
  jobId: string;
  deployId: string;
  projectId: string;
  composeProject: string;
  kind: JobKind;
  sha: string;
  status: JobStatus;
  error: string | null;
  rolledBackTo: string | null;
  at: string;
}

export interface AgentState {
  jobs: Job[];
  projects: Record<string, ProjectState>;
  outbox: AgentEvent[];
}
```

- [ ] **Step 4: Testy `agent/src/queue.test.ts`**

```ts
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
const input = (id: string, commit: string, composeProject?: string, kind: "deploy" | "rollback" = "deploy") => ({
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
    state = finishJob(state, "j1", { status: "succeeded", error: null, rolledBackTo: null, release: release("a"), orphanImages: [] }, "t3");
    expect(state.jobs[0]).toMatchObject({ status: "succeeded", finishedAt: "t3" });
    expect(state.projects["marczelloo-tools"].releases.map((item) => item.sha)).toEqual([sha("a")]);
    expect(state.outbox.at(-1)).toMatchObject({ id: "j1:finished", status: "succeeded" });
  });

  it("keeps releases unchanged after a rollback", () => {
    let state: AgentState = { ...emptyState(), projects: { "marczelloo-tools": { releases: [release("a")] } } };
    state = startJob(enqueue(state, input("j1", "b"), "t1").state, "j1", "t2");
    state = finishJob(state, "j1", { status: "rolled_back", error: "unhealthy", rolledBackTo: sha("a"), release: null, orphanImages: [] }, "t3");
    expect(state.projects["marczelloo-tools"].releases.map((item) => item.sha)).toEqual([sha("a")]);
    expect(state.outbox.at(-1)).toMatchObject({ status: "rolled_back", rolledBackTo: sha("a"), error: "unhealthy" });
  });
});

describe("recovery and helpers", () => {
  it("fails jobs that were running when the agent stopped", () => {
    let state = startJob(enqueue(emptyState(), input("j1", "a"), "t1").state, "j1", "t2");
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
```

- [ ] **Step 5: Uruchom — FAIL**

Run: `npx vitest run agent/src/queue.test.ts`
Expected: FAIL — `Cannot find module './queue'`.

- [ ] **Step 6: Implementacja `agent/src/queue.ts`**

```ts
import type { AgentEvent, AgentState, DeployTarget, Job, JobKind, JobStatus, Release } from "./types";

export const MAX_FINISHED_JOBS = 200;
export const MAX_RELEASES = 3;

const ACTIVE = new Set<JobStatus>(["queued", "running"]);

export interface EnqueueInput {
  id: string;
  kind: JobKind;
  target: DeployTarget;
  sha: string;
  deployId: string;
  triggeredBy: string;
}

export interface JobOutcome {
  status: "succeeded" | "failed" | "rolled_back";
  error: string | null;
  rolledBackTo: string | null;
  release: Release | null;
  /** Images built by this job that no release keeps (failed or rolled back deploys). */
  orphanImages: string[];
}

export function emptyState(): AgentState {
  return { jobs: [], projects: {}, outbox: [] };
}

function eventFor(job: Job, type: AgentEvent["type"], now: string): AgentEvent {
  return {
    id: `${job.id}:${type === "job.started" ? "started" : "finished"}`,
    type,
    jobId: job.id,
    deployId: job.deployId,
    projectId: job.target.projectId,
    composeProject: job.target.composeProject,
    kind: job.kind,
    sha: job.sha,
    status: job.status,
    error: job.error,
    rolledBackTo: job.rolledBackTo,
    at: now,
  };
}

function prune(state: AgentState): AgentState {
  const finished = state.jobs.filter((job) => !ACTIVE.has(job.status));
  const excess = finished.length - MAX_FINISHED_JOBS;
  if (excess <= 0) return state;
  const drop = new Set(finished.slice(0, excess).map((job) => job.id));
  return { ...state, jobs: state.jobs.filter((job) => !drop.has(job.id)) };
}

function updateJob(state: AgentState, jobId: string, change: (job: Job) => Job): { jobs: Job[]; job: Job } {
  let updated: Job | null = null;
  const jobs = state.jobs.map((job) => {
    if (job.id !== jobId) return job;
    updated = change(job);
    return updated;
  });
  if (!updated) throw new Error(`Nieznane zadanie ${jobId}.`);
  return { jobs, job: updated };
}

export function enqueue(state: AgentState, input: EnqueueInput, now: string): { state: AgentState; job: Job } {
  const job: Job = { ...input, status: "queued", createdAt: now, startedAt: null, finishedAt: null, error: null, rolledBackTo: null };
  const superseded = new Set(
    input.kind === "deploy"
      ? state.jobs
          .filter((candidate) => candidate.status === "queued" && candidate.kind === "deploy" && candidate.target.composeProject === input.target.composeProject)
          .map((candidate) => candidate.id)
      : []
  );
  const events: AgentEvent[] = [];
  const jobs = state.jobs.map((candidate) => {
    if (!superseded.has(candidate.id)) return candidate;
    // Only the newest push is built; the older request is closed explicitly.
    const closed: Job = { ...candidate, status: "superseded", finishedAt: now, error: `Zastąpione przez nowszy commit ${input.sha.slice(0, 7)}.` };
    events.push(eventFor(closed, "job.finished", now));
    return closed;
  });
  return { state: prune({ ...state, jobs: [...jobs, job], outbox: [...state.outbox, ...events] }), job };
}

export function nextJob(state: AgentState): Job | null {
  if (state.jobs.some((job) => job.status === "running")) return null;
  return state.jobs.find((job) => job.status === "queued") ?? null;
}

export function startJob(state: AgentState, jobId: string, now: string): AgentState {
  const { jobs, job } = updateJob(state, jobId, (current) => ({ ...current, status: "running", startedAt: now }));
  return { ...state, jobs, outbox: [...state.outbox, eventFor(job, "job.started", now)] };
}

export function recordRelease(releases: Release[], release: Release): Release[] {
  return [release, ...releases.filter((item) => item.sha !== release.sha)].slice(0, MAX_RELEASES);
}

export function finishJob(state: AgentState, jobId: string, outcome: JobOutcome, now: string): AgentState {
  const { jobs, job } = updateJob(state, jobId, (current) => ({
    ...current,
    status: outcome.status,
    error: outcome.error,
    rolledBackTo: outcome.rolledBackTo,
    finishedAt: now,
  }));
  const project = job.target.composeProject;
  const current = state.projects[project]?.releases ?? [];
  const releases = outcome.release ? recordRelease(current, outcome.release) : current;
  return prune({
    ...state,
    jobs,
    projects: { ...state.projects, [project]: { releases } },
    outbox: [...state.outbox, eventFor(job, "job.finished", now)],
  });
}

export function recoverAfterRestart(state: AgentState, now: string): AgentState {
  const events: AgentEvent[] = [];
  const jobs = state.jobs.map((job) => {
    if (job.status !== "running") return job;
    const failed: Job = { ...job, status: "failed", finishedAt: now, error: "Agent został zrestartowany w trakcie zadania — uruchom wdrożenie ponownie." };
    events.push(eventFor(failed, "job.finished", now));
    return failed;
  });
  return { ...state, jobs, outbox: [...state.outbox, ...events] };
}

export function rollbackRelease(state: AgentState, composeProject: string, sha?: string): Release | null {
  const releases = state.projects[composeProject]?.releases ?? [];
  if (sha) return releases.find((release) => release.sha === sha) ?? null;
  return releases[1] ?? null;
}

export function staleImages(before: Release[], after: Release[]): string[] {
  const kept = new Set(after.flatMap((release) => Object.values(release.images)));
  return [...new Set(before.flatMap((release) => Object.values(release.images)))].filter((image) => !kept.has(image));
}

export function acknowledgeEvents(state: AgentState, ids: string[]): AgentState {
  const delivered = new Set(ids);
  return { ...state, outbox: state.outbox.filter((event) => !delivered.has(event.id)) };
}
```

- [ ] **Step 7: Uruchom — PASS**

Run: `npx vitest run agent/src/queue.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add agent/package.json agent/package-lock.json agent/.gitignore agent/.dockerignore agent/src/types.ts agent/src/queue.ts agent/src/queue.test.ts tsconfig.json vitest.config.ts
git commit -m "feat: add deploy agent job model and queue"
```

---

### Task 2: Trwały stan i logi zadań

**Files:**
- Create: `agent/src/store.ts`
- Test: `agent/src/store.test.ts`

**Interfaces:**
- Consumes: `emptyState` (Task 1), `AgentState`.
- Produces: `export class FileStore { constructor(dataDir: string); load(): AgentState; save(state: AgentState): void; appendLog(jobId: string, text: string): void; readLog(jobId: string, offset: number, maxBytes?: number): { content: string; nextOffset: number } }`

- [ ] **Step 1: Testy `agent/src/store.test.ts`**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emptyState } from "./queue";
import { FileStore } from "./store";

const JOB = "0f8fad5b-d9cb-469f-a165-70867728950e";
const dirs: string[] = [];
function store() {
  const dir = mkdtempSync(path.join(tmpdir(), "mz-agent-"));
  dirs.push(dir);
  return new FileStore(dir);
}
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("FileStore", () => {
  it("returns an empty state before the first save and round-trips state", () => {
    const files = store();
    expect(files.load()).toEqual(emptyState());
    const state = { ...emptyState(), projects: { p: { releases: [] } } };
    files.save(state);
    expect(files.load()).toEqual(state);
  });

  it("appends logs and reads them from a byte offset", () => {
    const files = store();
    expect(files.readLog(JOB, 0)).toEqual({ content: "", nextOffset: 0 });
    files.appendLog(JOB, "zażółć\n");
    files.appendLog(JOB, "gęślą\n");
    const first = files.readLog(JOB, 0);
    expect(first.content).toBe("zażółć\ngęślą\n");
    files.appendLog(JOB, "jaźń\n");
    expect(files.readLog(JOB, first.nextOffset)).toEqual({ content: "jaźń\n", nextOffset: first.nextOffset + Buffer.byteLength("jaźń\n") });
  });

  it("rejects job ids that are not UUIDs", () => {
    expect(() => store().appendLog("../state", "x")).toThrow();
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run agent/src/store.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `agent/src/store.ts`**

```ts
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyState } from "./queue";
import type { AgentState } from "./types";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class FileStore {
  private readonly statePath: string;
  private readonly logDir: string;

  constructor(dataDir: string) {
    this.statePath = path.join(dataDir, "state.json");
    this.logDir = path.join(dataDir, "logs");
    mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
  }

  load(): AgentState {
    if (!existsSync(this.statePath)) return emptyState();
    return JSON.parse(readFileSync(this.statePath, "utf8")) as AgentState;
  }

  save(state: AgentState): void {
    const temporary = `${this.statePath}.tmp`;
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporary, this.statePath);
  }

  appendLog(jobId: string, text: string): void {
    appendFileSync(this.logPath(jobId), text, { mode: 0o600 });
  }

  readLog(jobId: string, offset: number, maxBytes = 256_000): { content: string; nextOffset: number } {
    const file = this.logPath(jobId);
    if (!existsSync(file)) return { content: "", nextOffset: offset };
    const size = statSync(file).size;
    if (offset >= size) return { content: "", nextOffset: offset };
    const length = Math.min(maxBytes, size - offset);
    const buffer = Buffer.alloc(length);
    const descriptor = openSync(file, "r");
    try {
      const bytesRead = readSync(descriptor, buffer, 0, length, offset);
      return { content: buffer.subarray(0, bytesRead).toString("utf8"), nextOffset: offset + bytesRead };
    } finally {
      closeSync(descriptor);
    }
  }

  private logPath(jobId: string): string {
    if (!JOB_ID.test(jobId)) throw new Error("Nieprawidłowy identyfikator zadania.");
    return path.join(this.logDir, `${jobId}.log`);
  }
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run agent/src/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent/src/store.ts agent/src/store.test.ts
git commit -m "feat: persist agent state and job logs"
```

---

### Task 3: Polecenia Git i Compose, override z tagami SHA

**Files:**
- Create: `agent/src/git.ts`
- Test: `agent/src/git.test.ts`
- Create: `agent/src/compose.ts`
- Test: `agent/src/compose.test.ts`

**Interfaces:**
- Consumes: `DeployTarget` (Task 1).
- Produces (`git.ts`):
  - `export interface CommandStep { label: string; command: "git" | "docker"; args: string[]; env?: Record<string, string>; timeoutMs: number; quiet?: boolean; allowFailure?: boolean; failOnOutput?: string }`
  - `export const SHA: RegExp`
  - `export function repositoryHttpsUrl(githubUrl: string): string`
  - `export function gitAuthEnv(token: string | null): Record<string, string>`
  - `export function gitSyncSteps(input: { repoPath: string; githubUrl: string; sha: string; token: string | null; repoExists: boolean }): CommandStep[]`
  - `export function gitCheckoutStep(repoPath: string, sha: string): CommandStep`
- Produces (`compose.ts`):
  - `export interface ComposeConfigJson { services?: Record<string, { image?: string; build?: unknown; ports?: Array<{ published?: string | number; target?: number; protocol?: string; host_ip?: string }> }> }`
  - `export function resolveComposeFile(target: DeployTarget, exists: (filePath: string) => boolean): string`
  - `export function composeArgs(target: DeployTarget, files: string[]): string[]`
  - `export function imageRepository(project: string, service: string, image?: string): string`
  - `export function loopbackPortOverride(config: ComposeConfigJson, port: number): { service: string; mapping: string } | null`
  - `export function renderOverride(images: Record<string, string>, port: { service: string; mapping: string } | null): string`
  - `export function buildOverride(config: ComposeConfigJson, input: { project: string; sha: string; tunnelPort: number | null }): { yaml: string; images: Record<string, string> }`

- [ ] **Step 1: Testy `agent/src/git.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { gitAuthEnv, gitCheckoutStep, gitSyncSteps, repositoryHttpsUrl } from "./git";

const SHA = "a".repeat(40);
const base = { repoPath: "/home/Marczelloo_pi/projects/marczelloo-tools", githubUrl: "git@github.com:Marczelloo/Marczelloo-Tools.git", sha: SHA, token: "ghs_secret" };

describe("repositoryHttpsUrl", () => {
  it("normalizes SSH and HTTPS GitHub URLs", () => {
    expect(repositoryHttpsUrl(base.githubUrl)).toBe("https://github.com/Marczelloo/Marczelloo-Tools.git");
    expect(repositoryHttpsUrl("https://github.com/Marczelloo/atlashub/")).toBe("https://github.com/Marczelloo/atlashub.git");
    expect(() => repositoryHttpsUrl("https://gitlab.com/a/b")).toThrow();
  });
});

describe("gitAuthEnv", () => {
  it("passes the token only as an extra header", () => {
    const env = gitAuthEnv("ghs_secret");
    expect(env.GIT_CONFIG_KEY_0).toBe("http.https://github.com/.extraheader");
    expect(env.GIT_CONFIG_VALUE_0).toBe(`Authorization: Basic ${Buffer.from("x-access-token:ghs_secret").toString("base64")}`);
    expect(gitAuthEnv(null)).not.toHaveProperty("GIT_CONFIG_VALUE_0");
    expect(gitAuthEnv(null).GIT_TERMINAL_PROMPT).toBe("0");
  });
});

describe("gitSyncSteps", () => {
  it("checks local changes, fetches the exact commit and checks it out detached", () => {
    const steps = gitSyncSteps({ ...base, repoExists: true });
    expect(steps.map((step) => step.args)).toEqual([
      ["-C", base.repoPath, "status", "--porcelain", "--untracked-files=no"],
      ["-C", base.repoPath, "fetch", "--no-tags", "https://github.com/Marczelloo/Marczelloo-Tools.git", SHA],
      ["-C", base.repoPath, "checkout", "--detach", SHA],
    ]);
    expect(steps[0]).toMatchObject({ quiet: true, failOnOutput: expect.stringContaining("lokalne zmiany") });
    expect(JSON.stringify(steps.map((step) => step.args))).not.toContain("ghs_secret");
  });

  it("clones a missing repository first", () => {
    expect(gitSyncSteps({ ...base, repoExists: false })[0].args).toEqual(["clone", "--no-checkout", "https://github.com/Marczelloo/Marczelloo-Tools.git", base.repoPath]);
  });

  it("rejects abbreviated or invalid SHAs", () => {
    expect(() => gitSyncSteps({ ...base, sha: "abc1234", repoExists: true })).toThrow();
    expect(() => gitCheckoutStep(base.repoPath, "main")).toThrow();
  });
});
```

- [ ] **Step 2: Testy `agent/src/compose.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildOverride, composeArgs, imageRepository, loopbackPortOverride, renderOverride, resolveComposeFile } from "./compose";
import type { DeployTarget } from "./types";

const target: DeployTarget = {
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject: "marczelloo-tools",
  repoPath: "/p/tools",
  githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
  branch: "main",
  composeFile: null,
  profiles: ["default"],
  tunnel: { hostname: "tools.marczelloo.dev", localPort: 3202 },
};
const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("resolveComposeFile", () => {
  it("uses the configured file or the first Compose candidate", () => {
    expect(resolveComposeFile({ ...target, composeFile: "deploy/compose.yml" }, () => true)).toBe("/p/tools/deploy/compose.yml");
    expect(resolveComposeFile(target, (file) => file === "/p/tools/docker-compose.yml")).toBe("/p/tools/docker-compose.yml");
    expect(() => resolveComposeFile(target, () => false)).toThrow(/Compose/);
  });
});

describe("composeArgs", () => {
  it("uses the directory of the first Compose file as the project directory", () => {
    expect(composeArgs({ ...target, profiles: [] }, ["/p/tools/deploy/compose.yml"]).slice(0, 5)).toEqual(["compose", "-p", "marczelloo-tools", "--project-directory", "/p/tools/deploy"]);
  });

  it("pins the project, directory, files and profiles", () => {
    expect(composeArgs(target, ["/p/tools/docker-compose.yml", "/o/tools.yml"])).toEqual([
      "compose", "-p", "marczelloo-tools", "--project-directory", "/p/tools",
      "-f", "/p/tools/docker-compose.yml", "-f", "/o/tools.yml", "--profile", "default",
    ]);
  });
});

describe("imageRepository", () => {
  it("derives the repository without tag or digest", () => {
    expect(imageRepository("marczelloo-tools", "app")).toBe("marczelloo-tools-app");
    expect(imageRepository("p", "s", "atlashub/gateway:latest")).toBe("atlashub/gateway");
    expect(imageRepository("p", "s", "localhost:5000/app@sha256:abc")).toBe("localhost:5000/app");
  });
});

describe("loopbackPortOverride", () => {
  const config = { services: { app: { build: {}, ports: [{ published: "3202", target: 3000, protocol: "tcp", host_ip: "0.0.0.0" }] }, db: { image: "postgres" } } };

  it("binds the only published port to loopback", () => {
    expect(loopbackPortOverride(config, 3202)).toEqual({ service: "app", mapping: "127.0.0.1:3202:3000/tcp" });
  });

  it("returns null when the port is already bound to loopback", () => {
    const bound = { services: { app: { ports: [{ published: "3202", target: 3000, host_ip: "127.0.0.1" }] } } };
    expect(loopbackPortOverride(bound, 3202)).toBeNull();
  });

  it("rejects ambiguous port layouts", () => {
    const ambiguous = { services: { a: { ports: [{ published: "1", target: 1 }] }, b: { ports: [{ published: "2", target: 2 }] } } };
    expect(() => loopbackPortOverride(ambiguous, 3202)).toThrow(/port/);
  });
});

describe("renderOverride and buildOverride", () => {
  it("renders images and a replaced port list", () => {
    expect(renderOverride({ app: "marczelloo-tools-app:0123456789ab" }, { service: "app", mapping: "127.0.0.1:3202:3000/tcp" })).toBe(
      'services:\n  "app":\n    image: "marczelloo-tools-app:0123456789ab"\n    ports: !override\n      - "127.0.0.1:3202:3000/tcp"\n'
    );
    expect(renderOverride({}, null)).toBe("services: {}\n");
  });

  it("pins only services that are built from source", () => {
    const result = buildOverride(
      { services: { app: { build: { context: "." }, ports: [{ published: "3202", target: 3000, host_ip: "127.0.0.1" }] }, db: { image: "postgres:16" } } },
      { project: "marczelloo-tools", sha: SHA, tunnelPort: 3202 }
    );
    expect(result.images).toEqual({ app: "marczelloo-tools-app:0123456789ab" });
    expect(result.yaml).toBe('services:\n  "app":\n    image: "marczelloo-tools-app:0123456789ab"\n');
  });
});
```

- [ ] **Step 3: Uruchom — FAIL**

Run: `npx vitest run agent/src/git.test.ts agent/src/compose.test.ts`
Expected: FAIL — brak modułów.

- [ ] **Step 4: Implementacja `agent/src/git.ts`**

```ts
export interface CommandStep {
  label: string;
  command: "git" | "docker";
  args: string[];
  env?: Record<string, string>;
  timeoutMs: number;
  /** Do not copy stdout into the job log (output can contain env values). */
  quiet?: boolean;
  allowFailure?: boolean;
  /** Fail the step with this message when stdout is not empty. */
  failOnOutput?: string;
}

export const SHA = /^[0-9a-f]{40}$/;

export function repositoryHttpsUrl(githubUrl: string): string {
  const match = /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(githubUrl.trim());
  if (!match) throw new Error("Agent obsługuje tylko repozytoria GitHub.");
  return `https://github.com/${match[1]}/${match[2]}.git`;
}

export function gitAuthEnv(token: string | null): Record<string, string> {
  const base = { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
  if (!token) return base;
  return {
    ...base,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`, "utf8").toString("base64")}`,
  };
}

function requireSha(sha: string) {
  if (!SHA.test(sha)) throw new Error("Nieprawidłowy SHA commita (wymagane 40 znaków).");
}

export function gitCheckoutStep(repoPath: string, sha: string): CommandStep {
  requireSha(sha);
  return { label: `Git checkout ${sha.slice(0, 7)}`, command: "git", args: ["-C", repoPath, "checkout", "--detach", sha], env: gitAuthEnv(null), timeoutMs: 120_000 };
}

export function gitSyncSteps(input: { repoPath: string; githubUrl: string; sha: string; token: string | null; repoExists: boolean }): CommandStep[] {
  requireSha(input.sha);
  const url = repositoryHttpsUrl(input.githubUrl);
  const env = gitAuthEnv(input.token);
  const steps: CommandStep[] = [];

  if (input.repoExists) {
    steps.push({
      label: "Sprawdzenie lokalnych zmian",
      command: "git",
      args: ["-C", input.repoPath, "status", "--porcelain", "--untracked-files=no"],
      env,
      timeoutMs: 60_000,
      quiet: true,
      failOnOutput: "Repozytorium na serwerze ma lokalne zmiany w śledzonych plikach — agent ich nie nadpisze.",
    });
  } else {
    steps.push({ label: "Git clone", command: "git", args: ["clone", "--no-checkout", url, input.repoPath], env, timeoutMs: 600_000 });
  }

  steps.push({ label: `Git fetch ${input.sha.slice(0, 7)}`, command: "git", args: ["-C", input.repoPath, "fetch", "--no-tags", url, input.sha], env, timeoutMs: 600_000 });
  steps.push(gitCheckoutStep(input.repoPath, input.sha));
  return steps;
}
```

- [ ] **Step 5: Implementacja `agent/src/compose.ts`**

```ts
import path from "node:path";
import type { DeployTarget } from "./types";

export interface ComposeConfigJson {
  services?: Record<string, { image?: string; build?: unknown; ports?: Array<{ published?: string | number; target?: number; protocol?: string; host_ip?: string }> }>;
}

const COMPOSE_CANDIDATES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];

export function resolveComposeFile(target: DeployTarget, exists: (filePath: string) => boolean): string {
  if (target.composeFile) {
    const configured = `${target.repoPath}/${target.composeFile}`;
    if (!exists(configured)) throw new Error(`Brak pliku Compose ${target.composeFile} w repozytorium.`);
    return configured;
  }
  const found = COMPOSE_CANDIDATES.map((name) => `${target.repoPath}/${name}`).find(exists);
  if (!found) throw new Error("Nie znaleziono pliku Compose w repozytorium.");
  return found;
}

export function composeArgs(target: DeployTarget, files: string[]): string[] {
  // Same default as Compose and the legacy script: the directory of the first file.
  return [
    "compose",
    "-p",
    target.composeProject,
    "--project-directory",
    path.posix.dirname(files[0]),
    ...files.flatMap((file) => ["-f", file]),
    ...target.profiles.flatMap((profile) => ["--profile", profile]),
  ];
}

export function imageRepository(project: string, service: string, image?: string): string {
  if (!image) return `${project}-${service}`;
  const withoutDigest = image.split("@")[0];
  const lastSlash = withoutDigest.lastIndexOf("/");
  const lastColon = withoutDigest.lastIndexOf(":");
  // A colon after the last slash is a tag; before it, a registry port.
  return lastColon > lastSlash ? withoutDigest.slice(0, lastColon) : withoutDigest;
}

export function loopbackPortOverride(config: ComposeConfigJson, port: number): { service: string; mapping: string } | null {
  const candidates = Object.entries(config.services ?? {}).flatMap(([service, definition]) =>
    (definition.ports ?? [])
      .filter((entry) => entry.published !== undefined && entry.target !== undefined && (entry.protocol ?? "tcp") === "tcp")
      .map((entry) => ({ service, published: String(entry.published), target: Number(entry.target), hostIp: entry.host_ip ?? "" }))
  );
  const matching = candidates.filter((candidate) => candidate.published === String(port));
  const chosen = candidates.length === 1 ? candidates[0] : matching.length === 1 ? matching[0] : null;
  if (!chosen) throw new Error("Automatyczny port wymaga jednego opublikowanego portu TCP (albo jednego już mapowanego na wybrany port).");
  if (chosen.published === String(port) && chosen.hostIp === "127.0.0.1") return null;
  return { service: chosen.service, mapping: `127.0.0.1:${port}:${chosen.target}/tcp` };
}

export function renderOverride(images: Record<string, string>, port: { service: string; mapping: string } | null): string {
  const names = [...new Set([...Object.keys(images), ...(port ? [port.service] : [])])].sort();
  if (!names.length) return "services: {}\n";
  const lines = ["services:"];
  for (const name of names) {
    lines.push(`  ${JSON.stringify(name)}:`);
    if (images[name]) lines.push(`    image: ${JSON.stringify(images[name])}`);
    if (port?.service === name) lines.push("    ports: !override", `      - ${JSON.stringify(port.mapping)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildOverride(config: ComposeConfigJson, input: { project: string; sha: string; tunnelPort: number | null }): { yaml: string; images: Record<string, string> } {
  const tag = input.sha.slice(0, 12);
  const images: Record<string, string> = {};
  for (const [service, definition] of Object.entries(config.services ?? {})) {
    if (definition.build) images[service] = `${imageRepository(input.project, service, definition.image)}:${tag}`;
  }
  const port = input.tunnelPort ? loopbackPortOverride(config, input.tunnelPort) : null;
  return { yaml: renderOverride(images, port), images };
}
```

- [ ] **Step 6: Uruchom — PASS**

Run: `npx vitest run agent/src/git.test.ts agent/src/compose.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add agent/src/git.ts agent/src/git.test.ts agent/src/compose.ts agent/src/compose.test.ts
git commit -m "feat: build SHA-pinned git and compose commands for the agent"
```

---

### Task 4: Bramka zdrowia

**Files:**
- Create: `agent/src/health.ts`
- Test: `agent/src/health.test.ts`

**Interfaces:**
- Produces:
  - `export interface ContainerSample { name: string; service: string; status: string; exitCode: number; restartCount: number; health: string | null }`
  - `export type GateState = { state: "pass" } | { state: "wait"; reason: string } | { state: "fail"; reason: string }`
  - `export function parseInspectSamples(json: string): ContainerSample[]`
  - `export function assessContainers(samples: ContainerSample[][], elapsedMs: number, options: { stableMs: number; timeoutMs: number }): GateState`
  - `export function assessProbe(status: number | null): "pass" | "retry"` (5xx lub brak odpowiedzi → ponów)

- [ ] **Step 1: Testy `agent/src/health.test.ts`**

```ts
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
  it("retries origin errors and passes anything the origin answered", () => {
    for (const status of [null, 500, 502, 503, 504, 520, 530]) expect(assessProbe(status)).toBe("retry");
    for (const status of [200, 301, 302, 401, 403, 404]) expect(assessProbe(status)).toBe("pass");
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run agent/src/health.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `agent/src/health.ts`**

```ts
export interface ContainerSample {
  name: string;
  service: string;
  status: string;
  exitCode: number;
  restartCount: number;
  health: string | null;
}

export type GateState = { state: "pass" } | { state: "wait"; reason: string } | { state: "fail"; reason: string };

interface RawInspect {
  Name: string;
  RestartCount?: number;
  State?: { Status?: string; ExitCode?: number; Health?: { Status?: string } | null } | null;
  Config?: { Labels?: Record<string, string> | null } | null;
}

export function parseInspectSamples(json: string): ContainerSample[] {
  return (JSON.parse(json) as RawInspect[])
    .filter((item) => item.Config?.Labels?.["com.docker.compose.oneoff"] !== "True")
    .map((item) => ({
      name: item.Name.replace(/^\//, ""),
      service: item.Config?.Labels?.["com.docker.compose.service"] ?? "",
      status: item.State?.Status ?? "unknown",
      exitCode: item.State?.ExitCode ?? 0,
      restartCount: item.RestartCount ?? 0,
      health: item.State?.Health?.Status ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function assessContainers(samples: ContainerSample[][], elapsedMs: number, options: { stableMs: number; timeoutMs: number }): GateState {
  const latest = samples.at(-1) ?? [];
  if (!latest.length) return { state: "fail", reason: "Projekt nie ma żadnych kontenerów po uruchomieniu." };

  const baseline = new Map<string, number>();
  for (const round of samples) for (const container of round) if (!baseline.has(container.name)) baseline.set(container.name, container.restartCount);

  for (const container of latest) {
    if (container.status === "exited" && container.exitCode !== 0) {
      return { state: "fail", reason: `Kontener ${container.name} zakończył działanie z kodem ${container.exitCode}.` };
    }
    if (container.status === "dead" || container.status === "restarting") {
      return { state: "fail", reason: `Kontener ${container.name} jest w stanie ${container.status}.` };
    }
    if (container.restartCount > (baseline.get(container.name) ?? container.restartCount)) {
      return { state: "fail", reason: `Kontener ${container.name} restartuje się.` };
    }
    if (container.health === "unhealthy") {
      return { state: "fail", reason: `Kontener ${container.name} zgłasza stan unhealthy.` };
    }
  }

  if (elapsedMs < options.stableMs) return { state: "wait", reason: "Obserwacja stabilności kontenerów." };

  const notReady = latest.filter((container) => container.health === "starting" || container.status === "created").map((container) => container.name);
  if (notReady.length) {
    return elapsedMs >= options.timeoutMs
      ? { state: "fail", reason: `Kontenery nie osiągnęły gotowości: ${notReady.join(", ")}.` }
      : { state: "wait", reason: `Czekam na healthcheck: ${notReady.join(", ")}.` };
  }
  return { state: "pass" };
}

export function assessProbe(status: number | null): "pass" | "retry" {
  if (status === null) return "retry";
  // 5xx: the application failed or (502/503/504, Cloudflare 52x) the origin did not answer.
  return status >= 500 ? "retry" : "pass";
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run agent/src/health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent/src/health.ts agent/src/health.test.ts
git commit -m "feat: assess container stability and public probes for the deploy gate"
```

---
### Task 5: Pipeline deployu i rollbacku

**Files:**
- Create: `agent/src/pipeline.ts`
- Test: `agent/src/pipeline.test.ts`

**Interfaces:**
- Consumes: `gitSyncSteps`, `gitCheckoutStep`, `CommandStep` (Task 3); `buildOverride`, `composeArgs`, `loopbackPortOverride`, `renderOverride`, `resolveComposeFile`, `ComposeConfigJson` (Task 3); `assessContainers`, `assessProbe`, `ContainerSample` (Task 4); `JobOutcome` (Task 1).
- Produces:
  - `export interface CommandResult { code: number; stdout: string; stderr: string }`
  - `export interface GateOptions { stableMs: number; timeoutMs: number; intervalMs: number; probeTimeoutMs: number }`
  - `export interface PipelineDeps { run(step: CommandStep): Promise<CommandResult>; exists(filePath: string): boolean; writeFile(filePath: string, content: string): void; sampleContainers(composeProject: string): Promise<ContainerSample[]>; probe(url: string): Promise<number | null>; sleep(ms: number): Promise<void>; log(line: string): void; now(): number; overrideDir: string; gate: GateOptions }`
  - `export async function waitForHealth(job: Job, deps: PipelineDeps): Promise<string | null>` (powód porażki albo `null`)
  - `export async function runDeploy(job: Job, token: string | null, previous: Release | null, deps: PipelineDeps): Promise<JobOutcome>`
  - `export async function runRollback(job: Job, release: Release, deps: PipelineDeps): Promise<JobOutcome>`

Kolejność deployu: sprawdzenie lokalnych zmian → `git fetch <sha>` → `git checkout --detach <sha>` → `compose config --format json` (bez logu) → override z tagami SHA i portem → `compose config -q` → `compose build` → `compose up -d --no-build` → bramka zdrowia. Porażka przed `up` nie zmienia działających kontenerów i kończy się `failed`. Porażka od `up` włącznie przywraca poprzednie wydanie (checkout jego SHA, override z jego obrazami, `up`, bramka) i kończy się `rolled_back`; obrazy nieudanego builda trafiają do `orphanImages` tylko po udanym rollbacku.

- [ ] **Step 1: Testy `agent/src/pipeline.test.ts`**

```ts
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
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run agent/src/pipeline.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `agent/src/pipeline.ts`**

```ts
import path from "node:path";
import { buildOverride, composeArgs, loopbackPortOverride, renderOverride, resolveComposeFile, type ComposeConfigJson } from "./compose";
import { gitCheckoutStep, gitSyncSteps, type CommandStep } from "./git";
import { assessContainers, assessProbe, type ContainerSample } from "./health";
import type { JobOutcome } from "./queue";
import type { Job, Release } from "./types";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface GateOptions {
  stableMs: number;
  timeoutMs: number;
  intervalMs: number;
  probeTimeoutMs: number;
}

export interface PipelineDeps {
  run(step: CommandStep): Promise<CommandResult>;
  exists(filePath: string): boolean;
  writeFile(filePath: string, content: string): void;
  sampleContainers(composeProject: string): Promise<ContainerSample[]>;
  probe(url: string): Promise<number | null>;
  sleep(ms: number): Promise<void>;
  log(line: string): void;
  now(): number;
  overrideDir: string;
  gate: GateOptions;
}

class StepError extends Error {}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

function dockerStep(label: string, args: string[], timeoutMs: number, quiet = false): CommandStep {
  return { label, command: "docker", args, timeoutMs, quiet };
}

async function runStep(deps: PipelineDeps, step: CommandStep): Promise<CommandResult> {
  deps.log(`=== ${step.label} ===`);
  const result = await deps.run(step);
  if (result.code !== 0 && !step.allowFailure) {
    const detail = result.stderr.trim().split("\n").slice(-5).join("\n");
    throw new StepError(`${step.label}: kod ${result.code}${detail ? `\n${detail}` : ""}`);
  }
  if (step.failOnOutput && result.stdout.trim()) throw new StepError(step.failOnOutput);
  return result;
}

async function composeConfig(job: Job, composeFile: string, deps: PipelineDeps): Promise<ComposeConfigJson> {
  const result = await runStep(deps, dockerStep("Compose config", [...composeArgs(job.target, [composeFile]), "config", "--format", "json"], 120_000, true));
  try {
    return JSON.parse(result.stdout) as ComposeConfigJson;
  } catch {
    throw new StepError("docker compose config zwrócił niepoprawny JSON.");
  }
}

const overridePath = (job: Job, deps: PipelineDeps) => path.posix.join(deps.overrideDir, `${job.target.composeProject}.yml`);

export async function waitForHealth(job: Job, deps: PipelineDeps): Promise<string | null> {
  deps.log("=== Bramka zdrowia ===");
  const started = deps.now();
  const samples: ContainerSample[][] = [];
  for (;;) {
    samples.push(await deps.sampleContainers(job.target.composeProject));
    const verdict = assessContainers(samples, deps.now() - started, deps.gate);
    if (verdict.state === "pass") break;
    if (verdict.state === "fail") return verdict.reason;
    await deps.sleep(deps.gate.intervalMs);
  }
  deps.log("Kontenery stabilne.");

  if (job.target.tunnel) {
    const url = `https://${job.target.tunnel.hostname}/`;
    const probeStarted = deps.now();
    for (;;) {
      const status = await deps.probe(url);
      deps.log(`Sonda ${url}: ${status ?? "brak odpowiedzi"}`);
      if (assessProbe(status) === "pass") break;
      if (deps.now() - probeStarted >= deps.gate.probeTimeoutMs) {
        return `Domena ${job.target.tunnel.hostname} nie odpowiada poprawnie (ostatni status: ${status ?? "brak"}).`;
      }
      await deps.sleep(deps.gate.intervalMs);
    }
  }
  return null;
}

async function upAndCheck(job: Job, files: string[], deps: PipelineDeps): Promise<string | null> {
  await runStep(deps, dockerStep("Uruchomienie", [...composeArgs(job.target, files), "up", "-d", "--no-build"], 10 * 60_000));
  return waitForHealth(job, deps);
}

async function restoreRelease(job: Job, release: Release, deps: PipelineDeps): Promise<string | null> {
  await runStep(deps, gitCheckoutStep(job.target.repoPath, release.sha));
  const composeFile = resolveComposeFile(job.target, deps.exists);
  const config = await composeConfig(job, composeFile, deps);
  const port = job.target.tunnel ? loopbackPortOverride(config, job.target.tunnel.localPort) : null;
  const file = overridePath(job, deps);
  deps.writeFile(file, renderOverride(release.images, port));
  return upAndCheck(job, [composeFile, file], deps);
}

function failed(error: string): JobOutcome {
  return { status: "failed", error, rolledBackTo: null, release: null, orphanImages: [] };
}

async function rollbackAfterFailure(job: Job, previous: Release | null, reason: string, builtImages: Record<string, string>, deps: PipelineDeps): Promise<JobOutcome> {
  if (!previous || previous.sha === job.sha) return failed(`${reason} Brak wcześniejszej wersji do przywrócenia.`);
  const short = previous.sha.slice(0, 7);
  deps.log(`=== Rollback do ${short} ===`);
  try {
    const restoreFailure = await restoreRelease(job, previous, deps);
    if (restoreFailure) return failed(`${reason} Rollback do ${short} nie przeszedł bramki: ${restoreFailure}`);
    const kept = new Set(Object.values(previous.images));
    return { status: "rolled_back", error: reason, rolledBackTo: previous.sha, release: null, orphanImages: Object.values(builtImages).filter((image) => !kept.has(image)) };
  } catch (error) {
    return failed(`${reason} Rollback do ${short} nie powiódł się: ${describeError(error)}`);
  }
}

export async function runDeploy(job: Job, token: string | null, previous: Release | null, deps: PipelineDeps): Promise<JobOutcome> {
  const { target } = job;
  let containersTouched = false;
  let images: Record<string, string> = {};
  try {
    const repoExists = deps.exists(`${target.repoPath}/.git`);
    if (!repoExists && deps.exists(target.repoPath)) {
      throw new StepError(`Katalog ${target.repoPath} istnieje, ale nie jest repozytorium Git.`);
    }
    for (const step of gitSyncSteps({ repoPath: target.repoPath, githubUrl: target.githubUrl, sha: job.sha, token, repoExists })) {
      await runStep(deps, step);
    }

    const composeFile = resolveComposeFile(target, deps.exists);
    const config = await composeConfig(job, composeFile, deps);
    const override = buildOverride(config, { project: target.composeProject, sha: job.sha, tunnelPort: target.tunnel?.localPort ?? null });
    images = override.images;
    const file = overridePath(job, deps);
    deps.writeFile(file, override.yaml);
    const files = [composeFile, file];

    await runStep(deps, dockerStep("Walidacja Compose", [...composeArgs(target, files), "config", "-q"], 120_000));
    await runStep(deps, dockerStep("Build", [...composeArgs(target, files), "build"], 45 * 60_000));

    containersTouched = true;
    const failure = await upAndCheck(job, files, deps);
    if (!failure) {
      return { status: "succeeded", error: null, rolledBackTo: null, release: { sha: job.sha, images, deployedAt: new Date(deps.now()).toISOString() }, orphanImages: [] };
    }
    return rollbackAfterFailure(job, previous, failure, images, deps);
  } catch (error) {
    return containersTouched ? rollbackAfterFailure(job, previous, describeError(error), images, deps) : failed(describeError(error));
  }
}

export async function runRollback(job: Job, release: Release, deps: PipelineDeps): Promise<JobOutcome> {
  try {
    const failure = await restoreRelease(job, release, deps);
    if (failure) return failed(`Przywrócona wersja ${release.sha.slice(0, 7)} nie przeszła bramki: ${failure}`);
    return { status: "succeeded", error: null, rolledBackTo: null, release: { ...release, deployedAt: new Date(deps.now()).toISOString() }, orphanImages: [] };
  } catch (error) {
    return failed(describeError(error));
  }
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run agent/src/pipeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent/src/pipeline.ts agent/src/pipeline.test.ts
git commit -m "feat: run SHA-pinned deploys with health gate and automatic rollback"
```

---

### Task 6: API agenta, dostarczanie zdarzeń i proces główny

**Files:**
- Create: `agent/src/api.ts`
- Create: `agent/src/server.ts`
- Test: `agent/src/server.test.ts`
- Create: `agent/src/reporter.ts`
- Test: `agent/src/reporter.test.ts`
- Create: `agent/src/exec.ts`, `agent/src/docker.ts`, `agent/src/main.ts`

**Interfaces:**
- Consumes: Task 1–5.
- Produces (`api.ts`): `export const deployTargetSchema`, `export const jobRequestSchema` (unia `kind: "deploy" | "rollback"`), `export type AgentJobRequest = z.infer<typeof jobRequestSchema>`, `export const agentEventSchema`.
- Produces (`server.ts`): `export interface ServerContext { token: string; allowedRoot: string; getState(): AgentState; mutate(change: (state: AgentState) => AgentState): void; store: Pick<FileStore, "readLog">; tokens: Map<string, string | null>; now(): string; newId(): string }`, `export function createAgentServer(context: ServerContext): http.Server`
- Produces (`reporter.ts`): `export async function deliverEvents(events: AgentEvent[], send: (event: AgentEvent) => Promise<boolean>): Promise<string[]>`, `export function httpEventSender(url: string, token: string, fetchImpl?: typeof fetch): (event: AgentEvent) => Promise<boolean>`
- Produces (`exec.ts`): `export function runCommand(step: CommandStep, onOutput: (chunk: string) => void): Promise<CommandResult>`
- Produces (`docker.ts`): `export async function sampleContainers(composeProject: string): Promise<ContainerSample[]>`, `export async function probe(url: string): Promise<number | null>`

HTTP API (wszystko poza `/health` wymaga `Authorization: Bearer <AGENT_TOKEN>`):

| Metoda i ścieżka | Wynik |
|---|---|
| `GET /health` | `200 {"ok":true}` |
| `POST /jobs` | `202` zadanie; `400` walidacja; `409` brak wydania do rollbacku |
| `GET /jobs/:id` | `200` zadanie / `404` |
| `GET /jobs/:id/log?offset=N` | `200 {"content","nextOffset"}` |
| `GET /projects/:composeProject` | `200 {"releases","activeJob"}` |

- [ ] **Step 1: `agent/src/api.ts`**

```ts
import { z } from "zod";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SHA = /^[0-9a-f]{40}$/;

export const deployTargetSchema = z.object({
  projectId: z.string().uuid(),
  composeProject: z.string().regex(IDENTIFIER).max(100),
  repoPath: z
    .string()
    .regex(/^\/[A-Za-z0-9._/@+-]+$/)
    .refine((value) => !value.split("/").includes(".."), "repoPath nie może zawierać ..")
    .transform((value) => value.replace(/\/+$/, "")),
  githubUrl: z.string().regex(/github\.com[/:][A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/, "Wymagane repozytorium GitHub."),
  branch: z
    .string()
    .regex(/^[A-Za-z0-9._/-]+$/)
    .refine((value) => !value.startsWith("-") && !value.includes(".."), "Nieprawidłowa gałąź."),
  composeFile: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_./-]*$/)
    .refine((value) => !value.includes(".."), "Nieprawidłowy plik Compose.")
    .nullable(),
  profiles: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)).max(10),
  tunnel: z.object({ hostname: z.string().regex(/^[a-z0-9.-]+$/).max(253), localPort: z.number().int().min(1).max(65535) }).nullable(),
});

export const jobRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("deploy"),
    target: deployTargetSchema,
    sha: z.string().regex(SHA),
    deployId: z.string().uuid(),
    triggeredBy: z.string().min(1).max(100),
    token: z.string().max(400).nullable(),
  }),
  z.object({
    kind: z.literal("rollback"),
    target: deployTargetSchema,
    sha: z.string().regex(SHA).nullable(),
    deployId: z.string().uuid(),
    triggeredBy: z.string().min(1).max(100),
  }),
]);

export type AgentJobRequest = z.input<typeof jobRequestSchema>;

export const agentEventSchema = z.object({
  id: z.string().max(80),
  type: z.enum(["job.started", "job.finished"]),
  jobId: z.string().uuid(),
  deployId: z.string().uuid(),
  projectId: z.string().uuid(),
  composeProject: z.string().regex(IDENTIFIER),
  kind: z.enum(["deploy", "rollback"]),
  sha: z.string().regex(SHA),
  status: z.enum(["queued", "running", "succeeded", "failed", "rolled_back", "superseded"]),
  error: z.string().nullable(),
  rolledBackTo: z.string().regex(SHA).nullable(),
  at: z.string(),
});
```

- [ ] **Step 2: Testy `agent/src/server.test.ts`**

```ts
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { emptyState } from "./queue";
import { createAgentServer, type ServerContext } from "./server";
import type { AgentState } from "./types";

const TOKEN = "t".repeat(40);
const JOB_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
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

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

async function start(initial: AgentState = emptyState()) {
  let state = initial;
  const tokens = new Map<string, string | null>();
  const context: ServerContext = {
    token: TOKEN,
    allowedRoot: "/home/Marczelloo_pi/projects",
    getState: () => state,
    mutate: (change) => {
      state = change(state);
    },
    store: { readLog: () => ({ content: "log", nextOffset: 3 }) },
    tokens,
    now: () => "2026-09-16T10:00:00.000Z",
    newId: () => JOB_ID,
  };
  const server = createAgentServer(context);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  stop = () => server.close();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, init: RequestInit = {}, auth = true) =>
    fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${TOKEN}` } : {}) } });
  return { call, tokens, state: () => state };
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

  it("returns jobs, logs and project state", async () => {
    const { call } = await start();
    await call("/jobs", { method: "POST", body: JSON.stringify(deploy) });
    expect((await call(`/jobs/${JOB_ID}`)).status).toBe(200);
    expect(await (await call(`/jobs/${JOB_ID}/log?offset=0`)).json()).toEqual({ content: "log", nextOffset: 3 });
    expect((await call("/jobs/00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect(await (await call("/projects/marczelloo-tools")).json()).toMatchObject({ releases: [], activeJob: { id: JOB_ID } });
  });
});
```

- [ ] **Step 3: Testy `agent/src/reporter.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { deliverEvents, httpEventSender } from "./reporter";
import type { AgentEvent } from "./types";

const event = (id: string): AgentEvent => ({
  id,
  type: "job.finished",
  jobId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  deployId: "22222222-2222-4222-8222-222222222222",
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject: "marczelloo-tools",
  kind: "deploy",
  sha: "b".repeat(40),
  status: "succeeded",
  error: null,
  rolledBackTo: null,
  at: "t",
});

describe("deliverEvents", () => {
  it("delivers in order and stops at the first failure", async () => {
    const sent: string[] = [];
    const delivered = await deliverEvents([event("a"), event("b"), event("c")], async (item) => {
      sent.push(item.id);
      return item.id !== "b";
    });
    expect(delivered).toEqual(["a"]);
    expect(sent).toEqual(["a", "b"]);
  });

  it("treats a thrown error as not delivered", async () => {
    expect(await deliverEvents([event("a")], async () => Promise.reject(new Error("offline")))).toEqual([]);
  });
});

describe("httpEventSender", () => {
  it("authenticates, accepts 2xx and drops events the dashboard rejects as invalid", async () => {
    const calls: RequestInit[] = [];
    const status = [200, 400, 503];
    const fake = (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(null, { status: status.shift() });
    }) as unknown as typeof fetch;
    const send = httpEventSender("http://dashboard/api/agent/events", "secret", fake);
    expect(await send(event("a"))).toBe(true);
    expect(await send(event("b"))).toBe(true);
    expect(await send(event("c"))).toBe(false);
    expect((calls[0].headers as Record<string, string>).authorization).toBe("Bearer secret");
  });
});
```

- [ ] **Step 4: Uruchom — FAIL**

Run: `npx vitest run agent/src/server.test.ts agent/src/reporter.test.ts`
Expected: FAIL — brak modułów.

- [ ] **Step 5: Implementacja `agent/src/server.ts`**

```ts
import { timingSafeEqual } from "node:crypto";
import http from "node:http";
import { jobRequestSchema } from "./api";
import { enqueue, rollbackRelease } from "./queue";
import type { FileStore } from "./store";
import type { AgentState, Job } from "./types";

export interface ServerContext {
  token: string;
  allowedRoot: string;
  getState(): AgentState;
  mutate(change: (state: AgentState) => AgentState): void;
  store: Pick<FileStore, "readLog">;
  tokens: Map<string, string | null>;
  now(): string;
  newId(): string;
}

function authorized(header: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function send(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function readBody(request: http.IncomingMessage, limit = 64_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Zbyt duże żądanie."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        resolve(null);
      }
    });
    request.on("error", reject);
  });
}

export function createAgentServer(context: ServerContext): http.Server {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://agent");
      if (request.method === "GET" && url.pathname === "/health") return send(response, 200, { ok: true });
      if (!authorized(request.headers.authorization, context.token)) return send(response, 401, { error: "Unauthorized" });

      if (request.method === "POST" && url.pathname === "/jobs") {
        const parsed = jobRequestSchema.safeParse(await readBody(request));
        if (!parsed.success) return send(response, 400, { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe żądanie." });
        const body = parsed.data;
        if (!body.target.repoPath.startsWith(`${context.allowedRoot}/`)) {
          return send(response, 400, { error: "Katalog repozytorium musi leżeć w katalogu projektów." });
        }

        let sha = body.sha;
        if (body.kind === "rollback") {
          const release = rollbackRelease(context.getState(), body.target.composeProject, body.sha ?? undefined);
          if (!release) return send(response, 409, { error: "Brak wcześniejszej wersji do przywrócenia." });
          sha = release.sha;
        }

        const id = context.newId();
        let created: Job | null = null;
        context.mutate((state) => {
          const result = enqueue(state, { id, kind: body.kind, target: body.target, sha: sha!, deployId: body.deployId, triggeredBy: body.triggeredBy }, context.now());
          created = result.job;
          return result.state;
        });
        context.tokens.set(id, body.kind === "deploy" ? body.token : null);
        return send(response, 202, created);
      }

      const jobMatch = /^\/jobs\/([0-9a-f-]{36})(\/log)?$/.exec(url.pathname);
      if (request.method === "GET" && jobMatch) {
        const job = context.getState().jobs.find((candidate) => candidate.id === jobMatch[1]);
        if (!job) return send(response, 404, { error: "Nie znaleziono zadania." });
        if (!jobMatch[2]) return send(response, 200, job);
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
        return send(response, 200, context.store.readLog(job.id, offset));
      }

      const projectMatch = /^\/projects\/([A-Za-z0-9][A-Za-z0-9_.-]*)$/.exec(url.pathname);
      if (request.method === "GET" && projectMatch) {
        const state = context.getState();
        const project = projectMatch[1];
        return send(response, 200, {
          releases: state.projects[project]?.releases ?? [],
          activeJob: state.jobs.find((job) => job.target.composeProject === project && (job.status === "queued" || job.status === "running")) ?? null,
        });
      }

      return send(response, 404, { error: "Not found" });
    } catch (error) {
      return send(response, 500, { error: error instanceof Error ? error.message : "Błąd agenta." });
    }
  });
}
```

- [ ] **Step 6: Implementacja `agent/src/reporter.ts`**

```ts
import type { AgentEvent } from "./types";

export async function deliverEvents(events: AgentEvent[], send: (event: AgentEvent) => Promise<boolean>): Promise<string[]> {
  const delivered: string[] = [];
  for (const event of events) {
    let ok = false;
    try {
      ok = await send(event);
    } catch {
      ok = false;
    }
    // Keep order: a later "finished" must never arrive before its "started".
    if (!ok) break;
    delivered.push(event.id);
  }
  return delivered;
}

export function httpEventSender(url: string, token: string, fetchImpl: typeof fetch = fetch) {
  return async (event: AgentEvent): Promise<boolean> => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10_000),
    });
    // 400 means the dashboard cannot ever accept this event; retrying would block the outbox.
    return response.ok || response.status === 400;
  };
}
```

- [ ] **Step 7: Uruchom testy — PASS**

Run: `npx vitest run agent/src/server.test.ts agent/src/reporter.test.ts`
Expected: PASS.

- [ ] **Step 8: `agent/src/exec.ts`**

```ts
import { spawn } from "node:child_process";
import type { CommandStep } from "./git";
import type { CommandResult } from "./pipeline";

const MAX_CAPTURE = 4 * 1024 * 1024;

export function runCommand(step: CommandStep, onOutput: (chunk: string) => void): Promise<CommandResult> {
  return new Promise((resolve) => {
    // Never inherit the agent environment: Compose prefers process variables over
    // a project's .env, so AGENT_TOKEN, NODE_ENV or PROJECTS_DIR would leak into apps.
    // Cast: Next.js augments ProcessEnv with a required NODE_ENV, which children must not get.
    const env = { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin", HOME: process.env.HOME ?? "/tmp", ...step.env } as unknown as NodeJS.ProcessEnv;
    const child = spawn(step.command, step.args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      onOutput(`\n[agent] Przekroczono limit czasu ${Math.round(step.timeoutMs / 1000)} s — przerywam.\n`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, step.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (stdout.length < MAX_CAPTURE) stdout += text;
      if (!step.quiet) onOutput(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (stderr.length < MAX_CAPTURE) stderr += text;
      onOutput(text);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
```

- [ ] **Step 9: `agent/src/docker.ts`**

```ts
import { runCommand } from "./exec";
import { parseInspectSamples, type ContainerSample } from "./health";

const silent = () => undefined;

export async function sampleContainers(composeProject: string): Promise<ContainerSample[]> {
  const ids = await runCommand(
    { label: "docker ps", command: "docker", args: ["ps", "-aq", "--filter", `label=com.docker.compose.project=${composeProject}`], timeoutMs: 30_000, quiet: true },
    silent
  );
  const list = ids.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  if (ids.code !== 0 || !list.length) return [];
  // docker inspect contains env values: never logged.
  const inspect = await runCommand({ label: "docker inspect", command: "docker", args: ["inspect", ...list], timeoutMs: 30_000, quiet: true }, silent);
  return inspect.code === 0 ? parseInspectSamples(inspect.stdout) : [];
}

export async function probe(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    return response.status;
  } catch {
    return null;
  }
}
```

- [ ] **Step 10: `agent/src/main.ts`**

```ts
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { probe, sampleContainers } from "./docker";
import { runCommand } from "./exec";
import { runDeploy, runRollback, type PipelineDeps } from "./pipeline";
import { acknowledgeEvents, finishJob, nextJob, recoverAfterRestart, staleImages, startJob, type JobOutcome } from "./queue";
import { deliverEvents, httpEventSender } from "./reporter";
import { createAgentServer } from "./server";
import { FileStore } from "./store";
import type { AgentState, Job } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const token = requireEnv("AGENT_TOKEN");
if (token.length < 32) throw new Error("AGENT_TOKEN must have at least 32 characters");
const projectsDir = requireEnv("PROJECTS_DIR").replace(/\/+$/, "");
const eventsUrl = requireEnv("DASHBOARD_EVENTS_URL");
const dataDir = process.env.AGENT_DATA_DIR || path.posix.join(projectsDir, ".dashboard", "agent");
const port = Number(process.env.AGENT_PORT || 8790);

const store = new FileStore(dataDir);
const overrideDir = path.posix.join(dataDir, "overrides");
mkdirSync(overrideDir, { recursive: true, mode: 0o700 });

const iso = () => new Date().toISOString();
let state: AgentState = recoverAfterRestart(store.load(), iso());
store.save(state);
const tokens = new Map<string, string | null>();
const mutate = (change: (current: AgentState) => AgentState) => {
  state = change(state);
  store.save(state);
};

createAgentServer({ token, allowedRoot: projectsDir, getState: () => state, mutate, store, tokens, now: iso, newId: randomUUID }).listen(port, "0.0.0.0", () => {
  console.log(`[agent] listening on :${port}, data in ${dataDir}`);
});

async function removeImages(images: string[]) {
  for (const image of images) {
    await runCommand({ label: "docker image rm", command: "docker", args: ["image", "rm", image], timeoutMs: 60_000, quiet: true, allowFailure: true }, () => undefined);
  }
}

async function execute(job: Job): Promise<JobOutcome> {
  const log = (line: string) => store.appendLog(job.id, line.endsWith("\n") ? line : `${line}\n`);
  const deps: PipelineDeps = {
    run: (step) => runCommand(step, (chunk) => store.appendLog(job.id, chunk)),
    exists: existsSync,
    writeFile: (file, content) => writeFileSync(file, content, { mode: 0o600 }),
    sampleContainers,
    probe,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log,
    now: Date.now,
    overrideDir,
    gate: { stableMs: 30_000, timeoutMs: 180_000, intervalMs: 5_000, probeTimeoutMs: 60_000 },
  };
  log(`[agent] ${job.kind} ${job.target.composeProject} @ ${job.sha} (${job.triggeredBy})`);
  const releases = state.projects[job.target.composeProject]?.releases ?? [];
  if (job.kind === "deploy") return runDeploy(job, tokens.get(job.id) ?? null, releases[0] ?? null, deps);
  const release = releases.find((candidate) => candidate.sha === job.sha);
  if (!release) return { status: "failed", error: "Wydanie do przywrócenia zniknęło z historii agenta.", rolledBackTo: null, release: null, orphanImages: [] };
  return runRollback(job, release, deps);
}

let working = false;
async function work() {
  if (working) return;
  const job = nextJob(state);
  if (!job) return;
  working = true;
  try {
    mutate((current) => startJob(current, job.id, iso()));
    const before = state.projects[job.target.composeProject]?.releases ?? [];
    let outcome: JobOutcome;
    try {
      outcome = await execute(job);
    } catch (error) {
      outcome = { status: "failed", error: `Błąd wewnętrzny agenta: ${error instanceof Error ? error.message : String(error)}`, rolledBackTo: null, release: null, orphanImages: [] };
    }
    store.appendLog(job.id, `[agent] Wynik: ${outcome.status}${outcome.error ? ` — ${outcome.error}` : ""}\n`);
    mutate((current) => finishJob(current, job.id, outcome, iso()));
    const after = state.projects[job.target.composeProject]?.releases ?? [];
    await removeImages([...staleImages(before, after), ...outcome.orphanImages]);
  } finally {
    tokens.delete(job.id);
    working = false;
  }
}

const sendEvent = httpEventSender(eventsUrl, token);
let reporting = false;
async function report() {
  if (reporting || !state.outbox.length) return;
  reporting = true;
  try {
    const delivered = await deliverEvents(state.outbox, sendEvent);
    if (delivered.length) mutate((current) => acknowledgeEvents(current, delivered));
  } finally {
    reporting = false;
  }
}

setInterval(() => void work(), 2_000);
setInterval(() => void report(), 5_000);
```

- [ ] **Step 11: Typy i wszystkie testy**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add agent/src/api.ts agent/src/server.ts agent/src/server.test.ts agent/src/reporter.ts agent/src/reporter.test.ts agent/src/exec.ts agent/src/docker.ts agent/src/main.ts
git commit -m "feat: expose the deploy agent API and run its job and event loops"
```

---

### Task 7: Obraz i stack agenta

**Files:**
- Create: `agent/Dockerfile`
- Create: `agent/docker-compose.yml`

- [ ] **Step 1: `agent/Dockerfile`**

```dockerfile
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Docker CLI and the Compose plugin are copied from the Raspberry Pi host by the
# runbook (agent/vendor). The agent must use the same Compose version as the
# host, otherwise Compose computes different config hashes and recreates
# containers that did not change.
COPY vendor/docker /usr/local/bin/docker
COPY vendor/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src

USER 1000:1000
ENV NODE_ENV=production HOME=/tmp/agent-home
CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/main.ts"]
```

- [ ] **Step 2: `agent/docker-compose.yml`**

```yaml
# Deploy agent. A separate Compose project, so deploying the dashboard stack
# never restarts the process that performs the deploy.
name: marczelloo-agent

services:
  agent:
    build: .
    image: marczelloo-agent:local
    container_name: marczelloo-agent
    restart: unless-stopped
    group_add:
      - "${DOCKER_GID:?DOCKER_GID is required (getent group docker)}"
    environment:
      AGENT_TOKEN: ${AGENT_TOKEN:?AGENT_TOKEN is required}
      PROJECTS_DIR: ${PROJECTS_DIR:-/home/Marczelloo_pi/projects}
      DASHBOARD_EVENTS_URL: http://marczelloo-dashboard:3100/api/agent/events
      AGENT_PORT: "8790"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      # Mounted under the same absolute path as on the host: Compose resolves
      # relative bind mounts and records config_files labels against it.
      - ${PROJECTS_DIR:-/home/Marczelloo_pi/projects}:${PROJECTS_DIR:-/home/Marczelloo_pi/projects}
    networks:
      dashboard:
        aliases:
          - mz-agent
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8790/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"

networks:
  dashboard:
    name: marczelloo-dashboard_marczelloo
    external: true
```

- [ ] **Step 3: Walidacja składni**

Run: `AGENT_TOKEN=x DOCKER_GID=991 docker compose -f agent/docker-compose.yml config -q`
Expected: brak błędów (walidacja nie wymaga istniejącej sieci ani binariów w `vendor/`).

- [ ] **Step 4: Commit**

```bash
git add agent/Dockerfile agent/docker-compose.yml
git commit -m "chore: add deploy agent image and compose stack"
```

---

### Task 8: Dashboard — odbiór zdarzeń agenta

**Files:**
- Create: `src/server/agent/refs.ts`
- Test: `src/server/agent/refs.test.ts`
- Create: `src/server/agent/event-plan.ts`
- Test: `src/server/agent/event-plan.test.ts`
- Create: `src/server/agent/client.ts`
- Create: `src/server/agent/handle-event.ts`
- Create: `src/app/api/agent/events/route.ts`
- Modify: `src/server/lib/public-paths.ts`, `src/server/lib/public-paths.test.ts`

**Interfaces:**
- Consumes: `AgentEvent`, `Job`, `Release` (`@agent/types`); `agentEventSchema`, `AgentJobRequest` (`@agent/api`).
- Produces:
  - `refs.ts`: `export function agentLogRef(jobId: string): string`, `export function parseAgentLogRef(value: string): string | null`
  - `event-plan.ts`: `export interface DeployUpdatePlan { status: DeployStatus; errorMessage: string | null; notify: "success" | "failed" | null }`, `export function planDeployUpdate(event: AgentEvent): DeployUpdatePlan`
  - `client.ts`: `isAgentConfigured(): boolean`, `enqueueAgentJob(request: AgentJobRequest): Promise<Job>`, `getAgentJob(jobId: string): Promise<Job>`, `readAgentJobLog(jobId: string, offset: number): Promise<{ content: string; nextOffset: number }>`, `getAgentProject(composeProject: string): Promise<{ releases: Release[]; activeJob: Job | null }>`
  - `handle-event.ts`: `export async function handleAgentEvent(event: AgentEvent): Promise<void>`

- [ ] **Step 1: Testy `src/server/agent/refs.test.ts` i `event-plan.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { agentLogRef, parseAgentLogRef } from "./refs";

describe("agent log refs", () => {
  it("round-trips job ids and rejects other values", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(parseAgentLogRef(agentLogRef(id))).toBe(id);
    expect(parseAgentLogRef("/home/Marczelloo_pi/projects/.dashboard/deploy-logs/x.log")).toBeNull();
    expect(parseAgentLogRef("agent:../../etc")).toBeNull();
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@agent/types";
import { planDeployUpdate } from "./event-plan";

const base: AgentEvent = {
  id: "j:finished",
  type: "job.finished",
  jobId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  deployId: "22222222-2222-4222-8222-222222222222",
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject: "marczelloo-tools",
  kind: "deploy",
  sha: "b".repeat(40),
  status: "succeeded",
  error: null,
  rolledBackTo: null,
  at: "t",
};

describe("planDeployUpdate", () => {
  it("maps job events to deploy statuses and notifications", () => {
    expect(planDeployUpdate({ ...base, type: "job.started", status: "running" })).toEqual({ status: "running", errorMessage: null, notify: null });
    expect(planDeployUpdate(base)).toEqual({ status: "success", errorMessage: null, notify: "success" });
    expect(planDeployUpdate({ ...base, status: "superseded", error: "Zastąpione" })).toEqual({ status: "cancelled", errorMessage: "Zastąpione", notify: null });
    expect(planDeployUpdate({ ...base, status: "failed", error: "Build: kod 1" })).toEqual({ status: "failed", errorMessage: "Build: kod 1", notify: "failed" });
  });

  it("explains a rollback in the error message", () => {
    const plan = planDeployUpdate({ ...base, status: "rolled_back", error: "Kontener restartuje się.", rolledBackTo: "a".repeat(40) });
    expect(plan).toMatchObject({ status: "failed", notify: "failed" });
    expect(plan.errorMessage).toBe("Bramka zdrowia nie przeszła — przywrócono aaaaaaa. Kontener restartuje się.");
  });
});
```

W `src/server/lib/public-paths.test.ts` w teście „allows health, GitHub webhook and cron endpoints” dopisz:

```ts
    expect(isPublicPath("/api/agent/events")).toBe(true);
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/agent src/server/lib/public-paths.test.ts`
Expected: FAIL — brak modułów i `/api/agent/events` nie jest publiczne.

- [ ] **Step 3: Implementacje czyste**

`src/server/agent/refs.ts`:

```ts
const PREFIX = "agent:";
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Stored in deploys.logs_object_key so existing UI can follow agent jobs. */
export function agentLogRef(jobId: string): string {
  return `${PREFIX}${jobId}`;
}

export function parseAgentLogRef(value: string): string | null {
  if (!value.startsWith(PREFIX)) return null;
  const jobId = value.slice(PREFIX.length);
  return JOB_ID.test(jobId) ? jobId : null;
}
```

`src/server/agent/event-plan.ts`:

```ts
import type { AgentEvent } from "@agent/types";
import type { DeployStatus } from "@/types";

export interface DeployUpdatePlan {
  status: DeployStatus;
  errorMessage: string | null;
  notify: "success" | "failed" | null;
}

export function planDeployUpdate(event: AgentEvent): DeployUpdatePlan {
  if (event.type === "job.started") return { status: "running", errorMessage: null, notify: null };
  switch (event.status) {
    case "succeeded":
      return { status: "success", errorMessage: null, notify: "success" };
    case "rolled_back":
      return {
        status: "failed",
        errorMessage: `Bramka zdrowia nie przeszła — przywrócono ${event.rolledBackTo?.slice(0, 7) ?? "poprzednią wersję"}. ${event.error ?? ""}`.trim(),
        notify: "failed",
      };
    case "superseded":
      return { status: "cancelled", errorMessage: event.error, notify: null };
    default:
      return { status: "failed", errorMessage: event.error ?? "Wdrożenie nie powiodło się.", notify: "failed" };
  }
}
```

`src/server/lib/public-paths.ts` — zamień zbiór i komentarz:

```ts
// Endpoints reachable without a Cloudflare Access identity. Each one performs
// its own authentication: HMAC signature (webhook), CRON_SECRET (cron),
// AGENT_TOKEN (deploy agent events) or exposes nothing sensitive (health).
const PUBLIC_PATHS = new Set(["/api/health", "/api/github/webhook", "/api/cron/monitoring", "/api/agent/events"]);
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run src/server/agent src/server/lib/public-paths.test.ts`
Expected: PASS.

- [ ] **Step 5: `src/server/agent/client.ts`**

```ts
import "server-only";

import type { AgentJobRequest } from "@agent/api";
import type { Job, Release } from "@agent/types";

const AGENT_URL = (process.env.AGENT_URL || "http://mz-agent:8790").replace(/\/+$/, "");

export function isAgentConfigured(): boolean {
  return Boolean(process.env.AGENT_TOKEN);
}

async function agentFetch<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.AGENT_TOKEN;
  if (!token) throw new Error("Agent wdrożeń nie jest skonfigurowany (brak AGENT_TOKEN).");
  const response = await fetch(`${AGENT_URL}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || `Agent odpowiedział statusem ${response.status}.`);
  return body as T;
}

export function enqueueAgentJob(request: AgentJobRequest): Promise<Job> {
  return agentFetch<Job>("/jobs", { method: "POST", body: JSON.stringify(request) });
}

export function getAgentJob(jobId: string): Promise<Job> {
  return agentFetch<Job>(`/jobs/${jobId}`);
}

export function readAgentJobLog(jobId: string, offset: number): Promise<{ content: string; nextOffset: number }> {
  return agentFetch(`/jobs/${jobId}/log?offset=${Math.max(0, Math.floor(offset))}`);
}

export function getAgentProject(composeProject: string): Promise<{ releases: Release[]; activeJob: Job | null }> {
  return agentFetch(`/projects/${encodeURIComponent(composeProject)}`);
}
```

- [ ] **Step 6: `src/server/agent/handle-event.ts`**

```ts
import "server-only";

import type { AgentEvent } from "@agent/types";
import { auditLogs, deploys, projects } from "@/server/atlashub";
import { notifyDeployFailed, notifyDeploySuccess } from "@/server/notifications";
import { planDeployUpdate } from "./event-plan";

const FINAL = new Set(["success", "failed", "cancelled"]);

export async function handleAgentEvent(event: AgentEvent): Promise<void> {
  const current = await deploys.getDeployById(event.deployId);
  if (!current) return;

  const plan = planDeployUpdate(event);
  // Events are redelivered after network errors; apply each transition once.
  if (current.status === plan.status) return;
  if (FINAL.has(current.status) && plan.status === "running") return;

  await deploys.updateDeployStatus(event.deployId, plan.status, {
    commit_sha: event.sha,
    ...(plan.errorMessage ? { error_message: plan.errorMessage } : {}),
  });
  if (event.type !== "job.finished") return;

  const project = await projects.getProjectById(event.projectId);
  const name = project?.name ?? event.composeProject;
  if (plan.notify === "success") await notifyDeploySuccess(name, event.sha.slice(0, 7));
  if (plan.notify === "failed") await notifyDeployFailed(name, plan.errorMessage ?? "Nieznany błąd");

  await auditLogs.logAction("deploy-agent", event.kind === "rollback" ? "rollback" : "deploy", "project", event.projectId, {
    job_id: event.jobId,
    deploy_id: event.deployId,
    sha: event.sha,
    status: event.status,
    rolled_back_to: event.rolledBackTo,
    error: event.error,
  });
}
```

- [ ] **Step 7: `src/app/api/agent/events/route.ts`**

```ts
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { agentEventSchema } from "@agent/api";
import { handleAgentEvent } from "@/server/agent/handle-event";

export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const token = process.env.AGENT_TOKEN;
  if (!token) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = agentEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  try {
    await handleAgentEvent(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[agent-events] Event not processed:", error);
    // 503 makes the agent retry, e.g. while AtlasHub is being redeployed.
    return NextResponse.json({ error: "Event not processed" }, { status: 503 });
  }
}
```

- [ ] **Step 8: Typy, lint, testy**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/agent src/app/api/agent src/server/lib/public-paths.ts src/server/lib/public-paths.test.ts
git commit -m "feat: receive deploy agent events and finalize deploy records"
```

---

### Task 9: Dashboard — kolejkowanie wdrożeń przez agenta

**Files:**
- Modify: `src/server/deployments/config.ts`
- Create: `src/server/deployments/commit.ts`
- Create: `src/server/agent/target.ts`
- Test: `src/server/agent/target.test.ts`
- Create: `src/server/agent/deploy.ts`
- Modify: `src/app/actions/projects.ts` (`queueConfiguredDeployment`, `internalDeployProject`, `checkDeployLogAction`)
- Modify: `src/app/api/github/webhook/route.ts`
- Modify: `docker-compose.yml`, `.env.example`

**Interfaces:**
- Consumes: Task 8 (`enqueueAgentJob`, `getAgentJob`, `readAgentJobLog`, `agentLogRef`); `getBranch`, `parseGitHubUrl`, `getRepositoryCloneToken` (`@/server/github/client`); `updateCloudflareTunnelRoute` (`@/server/deployments/host`).
- Produces:
  - `DeploymentConfig.engine?: "script" | "agent"` (brak = `"script"`)
  - `commit.ts`: `export async function resolveBranchHead(githubUrl: string, branch: string): Promise<string>`
  - `target.ts`: `export function toAgentTarget(config: DeploymentConfig): DeployTarget`
  - `deploy.ts`: `export async function queueAgentDeployment(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; commitSha?: string }): Promise<{ deployId: string; jobId: string; sha: string }>`, `export async function queueAgentRollback(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; sha?: string }): Promise<{ deployId: string; jobId: string; sha: string }>`, `export async function readAgentDeployLog(jobId: string): Promise<{ log: string; isComplete: boolean; success: boolean }>`
  - `internalDeployProject(id, triggeredBy, options?: { customRepoPath?: string; branch?: string; commitSha?: string })`

- [ ] **Step 1: Test `src/server/agent/target.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { DeploymentConfig } from "@/server/deployments/config";
import { toAgentTarget } from "./target";

const config: DeploymentConfig = {
  version: 1,
  projectId: "11111111-1111-4111-8111-111111111111",
  githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
  branch: "main",
  repoPath: "/home/Marczelloo_pi/projects/marczelloo-tools",
  composeFile: null,
  composeProject: "marczelloo-tools",
  profiles: [],
  runtime: "web",
  exposure: "cloudflare",
  tunnel: { enabled: true, hostname: "tools.marczelloo.dev", localPort: 3202 },
  engine: "agent",
  createdAt: "t",
  updatedAt: "t",
};

describe("toAgentTarget", () => {
  it("keeps only what the agent needs", () => {
    expect(toAgentTarget(config)).toEqual({
      projectId: config.projectId,
      composeProject: "marczelloo-tools",
      repoPath: config.repoPath,
      githubUrl: config.githubUrl,
      branch: "main",
      composeFile: null,
      profiles: [],
      tunnel: { hostname: "tools.marczelloo.dev", localPort: 3202 },
    });
  });

  it("drops a disabled tunnel", () => {
    expect(toAgentTarget({ ...config, tunnel: { enabled: false, hostname: "x.pl", localPort: 1 } }).tunnel).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/agent/target.test.ts`
Expected: FAIL — brak modułu i pola `engine`.

- [ ] **Step 3: Pole `engine` w `src/server/deployments/config.ts`**

W interfejsie `DeploymentConfig` po `tunnel: CloudflareTunnelRoute | null;` dodaj:

```ts
  /** Deploy engine; missing means the legacy runner script. */
  engine?: "script" | "agent";
```

W `isDeploymentConfig` przed `["web", "worker", "bot", "stack"]` dodaj warunek:

```ts
    (config.engine === undefined || config.engine === "script" || config.engine === "agent") &&
```

- [ ] **Step 4: `src/server/agent/target.ts` i `src/server/deployments/commit.ts`**

```ts
import type { DeployTarget } from "@agent/types";
import type { DeploymentConfig } from "@/server/deployments/config";

export function toAgentTarget(config: DeploymentConfig): DeployTarget {
  return {
    projectId: config.projectId,
    composeProject: config.composeProject,
    repoPath: config.repoPath,
    githubUrl: config.githubUrl,
    branch: config.branch,
    composeFile: config.composeFile,
    profiles: config.profiles,
    tunnel: config.tunnel?.enabled ? { hostname: config.tunnel.hostname, localPort: config.tunnel.localPort } : null,
  };
}
```

```ts
import "server-only";

import { getBranch, parseGitHubUrl } from "@/server/github/client";

export async function resolveBranchHead(githubUrl: string, branch: string): Promise<string> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error("Nieprawidłowy adres repozytorium GitHub.");
  const result = await getBranch(parsed.owner, parsed.repo, branch);
  if (!/^[0-9a-f]{40}$/.test(result.commit.sha)) throw new Error(`GitHub nie zwrócił SHA gałęzi ${branch}.`);
  return result.commit.sha;
}
```

- [ ] **Step 5: Uruchom test — PASS**

Run: `npx vitest run src/server/agent/target.test.ts`
Expected: PASS.

- [ ] **Step 6: `src/server/agent/deploy.ts`**

```ts
import "server-only";

import { deploys } from "@/server/atlashub";
import type { DeploymentConfig } from "@/server/deployments/config";
import { resolveBranchHead } from "@/server/deployments/commit";
import { updateCloudflareTunnelRoute } from "@/server/deployments/host";
import { getRepositoryCloneToken } from "@/server/github/client";
import { enqueueAgentJob, getAgentJob, readAgentJobLog } from "./client";
import { agentLogRef } from "./refs";
import { toAgentTarget } from "./target";

const describeError = (error: unknown) => (error instanceof Error ? error.message : "Agent odrzucił zadanie.");

export async function queueAgentDeployment(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; commitSha?: string }): Promise<{ deployId: string; jobId: string; sha: string }> {
  const { config } = input;
  const sha = input.commitSha && /^[0-9a-f]{40}$/.test(input.commitSha) ? input.commitSha : await resolveBranchHead(config.githubUrl, config.branch);

  // The health gate probes the public hostname, so the route must exist before the job runs.
  if (config.tunnel?.enabled) {
    await updateCloudflareTunnelRoute({ hostname: config.tunnel.hostname, localPort: config.tunnel.localPort });
  }

  const deploy = await deploys.createDeploy({ service_id: input.serviceId, triggered_by: input.triggeredBy, commit_sha: sha });
  try {
    const token = await getRepositoryCloneToken(config.githubUrl).catch(() => null);
    const job = await enqueueAgentJob({ kind: "deploy", target: toAgentTarget(config), sha, deployId: deploy.id, triggeredBy: input.triggeredBy.slice(0, 100), token });
    await deploys.setDeployLogFile(deploy.id, agentLogRef(job.id));
    return { deployId: deploy.id, jobId: job.id, sha };
  } catch (error) {
    await deploys.completeDeploy(deploy.id, false, { error_message: describeError(error) });
    throw error;
  }
}

export async function queueAgentRollback(input: { config: DeploymentConfig; serviceId: string; triggeredBy: string; sha?: string }): Promise<{ deployId: string; jobId: string; sha: string }> {
  const deploy = await deploys.createDeploy({ service_id: input.serviceId, triggered_by: input.triggeredBy, ...(input.sha ? { commit_sha: input.sha } : {}) });
  try {
    const job = await enqueueAgentJob({ kind: "rollback", target: toAgentTarget(input.config), sha: input.sha ?? null, deployId: deploy.id, triggeredBy: input.triggeredBy.slice(0, 100) });
    await deploys.setDeployLogFile(deploy.id, agentLogRef(job.id));
    return { deployId: deploy.id, jobId: job.id, sha: job.sha };
  } catch (error) {
    await deploys.completeDeploy(deploy.id, false, { error_message: describeError(error) });
    throw error;
  }
}

export async function readAgentDeployLog(jobId: string): Promise<{ log: string; isComplete: boolean; success: boolean }> {
  const [job, log] = await Promise.all([getAgentJob(jobId), readAgentJobLog(jobId, 0)]);
  return {
    log: log.content.slice(-60_000),
    isComplete: job.status !== "queued" && job.status !== "running",
    success: job.status === "succeeded",
  };
}
```

- [ ] **Step 7: `src/app/actions/projects.ts`**

Dodaj importy:

```ts
import { queueAgentDeployment, readAgentDeployLog } from "@/server/agent/deploy";
import { agentLogRef, parseAgentLogRef } from "@/server/agent/refs";
```

Zmień sygnaturę:

```ts
async function queueConfiguredDeployment(
  projectId: string,
  triggeredBy: string,
  branchOverride?: string,
  commitSha?: string
): Promise<ActionResult<{ output: string; deployId: string; logFile: string; branch: string }>> {
```

Bezpośrednio po linii `const service = await ensureDeploymentService(projectId, project.name, config);` wstaw:

```ts
  if (config.engine === "agent") {
    const queued = await queueAgentDeployment({ config, serviceId: service.id, triggeredBy, commitSha });
    const logFile = agentLogRef(queued.jobId);
    await auditLogs.logAction(triggeredBy, "deploy", "project", projectId, {
      mode: "agent-job",
      compose_project: config.composeProject,
      branch: config.branch,
      sha: queued.sha,
      deploy_id: queued.deployId,
      job_id: queued.jobId,
      tunnel_port_reallocated: reallocatedPort !== null,
      adopted_existing_tunnel_route: adoptedTunnelRoute,
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        deployId: queued.deployId,
        logFile,
        branch: config.branch,
        output: `Wdrożenie ${queued.sha.slice(0, 7)} trafiło do kolejki agenta.\nLog file: ${logFile}\n\nEtapy: git fetch → Compose config → build → up → bramka zdrowia → rollback przy błędzie.`,
      },
    };
  }
```

W `internalDeployProject` zmień typ opcji na:

```ts
  options?: {
    customRepoPath?: string;
    branch?: string;
    commitSha?: string;
  }
```

i wywołanie `return queueConfiguredDeployment(id, triggeredBy, branch);` na:

```ts
    return queueConfiguredDeployment(id, triggeredBy, branch, options?.commitSha);
```

W `checkDeployLogAction` bezpośrednio po `await requireAuth();` wstaw:

```ts
    const agentJobId = parseAgentLogRef(logFile);
    if (agentJobId) {
      const agentLog = await readAgentDeployLog(agentJobId);
      return { success: true, data: { log: agentLog.log, isComplete: agentLog.isComplete } };
    }
```

`refreshRunningDeploysAction` nie wymaga zmian: referencje `agent:` nie przechodzą `isDeploymentLogPath` i są pomijane, a status kończy agent.

- [ ] **Step 8: Webhook przekazuje SHA**

W `src/app/api/github/webhook/route.ts` zamień:

```ts
      const deployResult = await internalDeployProject(project.id, "github-webhook", deploymentConfig ? {} : { branch: decision.branch });
```

na:

```ts
      const deployResult = await internalDeployProject(
        project.id,
        "github-webhook",
        deploymentConfig ? { commitSha: head_commit?.id } : { branch: decision.branch }
      );
```

- [ ] **Step 9: Zmienne środowiskowe**

W `docker-compose.yml` w `environment` usługi `dashboard` pod `- RUNNER_TOKEN=${RUNNER_TOKEN}` dodaj:

```yaml

      # Deploy agent (separate marczelloo-agent stack on the same network)
      - AGENT_URL=${AGENT_URL:-http://mz-agent:8790}
      - AGENT_TOKEN=${AGENT_TOKEN}
```

W `.env.example` po sekcji runnera dodaj:

```bash
# ========================================
# Deploy agent (stage 2)
# ========================================
# Shared with agent/.env; generate with: openssl rand -hex 32
AGENT_TOKEN=
# AGENT_URL=http://mz-agent:8790
```

- [ ] **Step 10: Typy, lint, testy, build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/server/deployments/config.ts src/server/deployments/commit.ts src/server/agent/target.ts src/server/agent/target.test.ts src/server/agent/deploy.ts src/app/actions/projects.ts src/app/api/github/webhook/route.ts docker-compose.yml .env.example
git commit -m "feat: queue managed deployments through the deploy agent"
```

---

### Task 10: Dashboard — logi na żywo, silnik wdrożeń i rollback w UI

**Files:**
- Create: `src/server/agent/log-stream.ts`
- Modify: `src/app/api/deploy/logs/stream/route.ts`
- Create: `src/app/actions/agent-deploy.ts`
- Create: `src/app/(dashboard)/projects/[id]/_components/project-deploy-engine.tsx`
- Modify: `src/app/(dashboard)/projects/[id]/_components/project-detail-tabs.tsx`

**Interfaces:**
- Consumes: Task 8–9.
- Produces:
  - `export function agentLogStream(jobId: string, signal: AbortSignal): Response` — zdarzenia SSE `log`, `status`, `error`, `complete` w formacie obecnego strumienia.
  - `getDeployEngineAction(projectId: string)`, `setDeployEngineAction(projectId: string, engine: "script" | "agent")`, `rollbackProjectAction(projectId: string, sha?: string)`

- [ ] **Step 1: `src/server/agent/log-stream.ts`**

```ts
import "server-only";

import { getAgentJob, readAgentJobLog } from "./client";

const HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export function agentLogStream(jobId: string, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let offset = 0;
      let complete = false;
      let success = false;
      const send = (event: string, data: unknown) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      const deadline = Date.now() + 60 * 60 * 1000;
      while (!closed && !signal.aborted && Date.now() < deadline) {
        try {
          const job = await getAgentJob(jobId);
          complete = job.status !== "queued" && job.status !== "running";
          success = job.status === "succeeded";
          // Read after the status so the final lines of a finished job are included.
          const log = await readAgentJobLog(jobId, offset);
          if (log.content && !send("log", { content: log.content })) break;
          offset = log.nextOffset;
          if (!send("status", { running: !complete, offset, success, agentStatus: job.status })) break;
          if (complete) break;
        } catch {
          if (!send("error", { message: "Nie udało się odczytać logu agenta" })) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!closed) {
        send("complete", { success, totalBytes: offset, timedOut: !complete });
        try {
          controller.close();
        } catch {
          // The client disconnected between the event and close().
        }
      }
    },
  });
  return new Response(stream, { headers: HEADERS });
}
```

- [ ] **Step 2: Strumień w `src/app/api/deploy/logs/stream/route.ts`**

Dodaj importy:

```ts
import { agentLogStream } from "@/server/agent/log-stream";
import { parseAgentLogRef } from "@/server/agent/refs";
```

Zamień:

```ts
  if (!logFile) return new Response("logFile parameter required", { status: 400 });
```

na:

```ts
  if (!logFile) return new Response("logFile parameter required", { status: 400 });
  const agentJobId = parseAgentLogRef(logFile);
  if (agentJobId) return agentLogStream(agentJobId, request.signal);
```

- [ ] **Step 3: `src/app/actions/agent-deploy.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Job, Release } from "@agent/types";
import type { ActionResult } from "@/app/actions/projects";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { getAgentProject, isAgentConfigured } from "@/server/agent/client";
import { queueAgentRollback } from "@/server/agent/deploy";
import { agentLogRef } from "@/server/agent/refs";
import { auditLogs, services } from "@/server/atlashub";
import { getDeploymentConfig, saveDeploymentConfig } from "@/server/deployments/config";
import { AuthError, requireAuth, requirePinVerification } from "@/server/lib/auth";

type Result<T> = ActionResult<T> & { code?: string };
type Engine = "script" | "agent";

function failure(error: unknown): Result<never> {
  if (error instanceof AuthError) return { success: false, error: error.message, code: error.code };
  if (error instanceof z.ZodError) return { success: false, error: error.errors[0]?.message ?? "Nieprawidłowe dane." };
  return { success: false, error: error instanceof Error ? error.message : "Operacja nie powiodła się." };
}

export async function getDeployEngineAction(projectId: string): Promise<
  Result<{ managed: boolean; engine: Engine; agentConfigured: boolean; releases: Release[]; activeJob: Job | null; agentError: string | null }>
> {
  try {
    await requireAuth();
    const config = await getDeploymentConfig(projectId);
    const agentConfigured = isAgentConfigured();
    if (!config) {
      return { success: true, data: { managed: false, engine: "script", agentConfigured, releases: [], activeJob: null, agentError: null } };
    }
    let releases: Release[] = [];
    let activeJob: Job | null = null;
    let agentError: string | null = null;
    if (agentConfigured && config.engine === "agent") {
      try {
        ({ releases, activeJob } = await getAgentProject(config.composeProject));
      } catch (error) {
        agentError = error instanceof Error ? error.message : "Agent jest niedostępny.";
      }
    }
    return { success: true, data: { managed: true, engine: config.engine ?? "script", agentConfigured, releases, activeJob, agentError } };
  } catch (error) {
    return failure(error);
  }
}

const engineSchema = z.enum(["script", "agent"]);

export async function setDeployEngineAction(projectId: string, engine: Engine): Promise<Result<{ engine: Engine }>> {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return demo.result;
    const user = await requirePinVerification();
    const parsed = engineSchema.parse(engine);
    const config = await getDeploymentConfig(projectId);
    if (!config) return { success: false, error: "Projekt nie ma konfiguracji wdrożenia." };
    if (parsed === "agent" && !isAgentConfigured()) return { success: false, error: "Agent nie jest skonfigurowany (brak AGENT_TOKEN)." };

    await saveDeploymentConfig({ ...config, engine: parsed });
    await auditLogs.logAction(user.email, "update", "project", projectId, { deploy_engine: parsed, previous_engine: config.engine ?? "script" });
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { engine: parsed } };
  } catch (error) {
    return failure(error);
  }
}

export async function rollbackProjectAction(projectId: string, sha?: string): Promise<Result<{ deployId: string; logFile: string }>> {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return demo.result;
    const user = await requirePinVerification();
    if (sha !== undefined && !/^[0-9a-f]{40}$/.test(sha)) return { success: false, error: "Nieprawidłowy SHA wydania." };

    const config = await getDeploymentConfig(projectId);
    if (!config || config.engine !== "agent") return { success: false, error: "Rollback działa tylko dla projektów wdrażanych przez agenta." };
    const serviceRows = await services.getServicesByProjectId(projectId);
    const service = serviceRows.find((row) => row.compose_project === config.composeProject) ?? serviceRows.find((row) => row.type === "docker");
    if (!service) return { success: false, error: "Projekt nie ma serwisu Docker — wykonaj najpierw wdrożenie." };

    const queued = await queueAgentRollback({ config, serviceId: service.id, triggeredBy: user.email, sha });
    await auditLogs.logAction(user.email, "rollback", "project", projectId, { deploy_id: queued.deployId, job_id: queued.jobId, sha: queued.sha });
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: { deployId: queued.deployId, logFile: agentLogRef(queued.jobId) } };
  } catch (error) {
    return failure(error);
  }
}
```

- [ ] **Step 4: `src/app/(dashboard)/projects/[id]/_components/project-deploy-engine.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, History, Loader2, RotateCcw, Terminal } from "lucide-react";
import { toast } from "sonner";
import { getDeployEngineAction, rollbackProjectAction, setDeployEngineAction } from "@/app/actions/agent-deploy";
import { PinDialog } from "@/components/pin-dialog";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type EngineData = NonNullable<Awaited<ReturnType<typeof getDeployEngineAction>>["data"]>;
type PendingAction = { kind: "engine"; engine: "script" | "agent" } | { kind: "rollback"; sha: string };

const JOB_STATUS: Record<string, string> = { queued: "w kolejce", running: "w toku" };
const formatDate = (value: string) => new Date(value).toLocaleString("pl-PL");

export function ProjectDeployEngine({ projectId }: { projectId: string }) {
  const [data, setData] = useState<EngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDeployEngineAction(projectId);
    if (result.success && result.data) setData(result.data);
    else toast.error("Nie udało się odczytać silnika wdrożeń", { description: result.error });
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function execute(action: PendingAction) {
    setBusy(true);
    const result = action.kind === "engine" ? await setDeployEngineAction(projectId, action.engine) : await rollbackProjectAction(projectId, action.sha);
    setBusy(false);
    if (result.code === "PIN_REQUIRED") {
      setPending(action);
      return;
    }
    if (!result.success) {
      toast.error(action.kind === "engine" ? "Nie zmieniono silnika wdrożeń" : "Nie zakolejkowano rollbacku", { description: result.error });
      return;
    }
    toast.success(action.kind === "engine" ? "Zmieniono silnik wdrożeń" : "Rollback trafił do kolejki agenta");
    await load();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Wczytywanie silnika wdrożeń…
        </CardContent>
      </Card>
    );
  }
  if (!data?.managed) return null;

  const agent = data.engine === "agent";
  const [current, ...previous] = data.releases;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {agent ? <Bot className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
              Silnik wdrożeń
            </CardTitle>
            <CardDescription>
              {agent
                ? "Agent: kolejka, obrazy z tagiem commita, bramka zdrowia i automatyczny rollback."
                : "Skrypt: dotychczasowy deploy przez runner, bez bramki zdrowia."}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || (!agent && !data.agentConfigured)}
            onClick={() => execute({ kind: "engine", engine: agent ? "script" : "agent" })}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {agent ? "Wróć do skryptu" : "Przełącz na agenta"}
          </Button>
        </CardHeader>
        {agent && (
          <CardContent className="space-y-3 text-sm">
            {data.agentError && <p className="text-danger">{data.agentError}</p>}
            {data.activeJob && (
              <p>
                Zadanie {JOB_STATUS[data.activeJob.status] ?? data.activeJob.status}: <span className="font-mono">{data.activeJob.sha.slice(0, 7)}</span>
              </p>
            )}
            {current ? (
              <div className="flex flex-wrap items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Aktualna wersja
                <Badge variant="success" className="font-mono">
                  {current.sha.slice(0, 7)}
                </Badge>
                <span className="text-muted-foreground">{formatDate(current.deployedAt)}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">Agent nie wdrożył jeszcze tego projektu.</p>
            )}
            {previous.length > 0 && (
              <ul className="space-y-1">
                {previous.map((release) => (
                  <li key={release.sha} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-mono">{release.sha.slice(0, 7)}</span> <span className="text-muted-foreground">{formatDate(release.deployedAt)}</span>
                    </span>
                    <Button variant="outline" size="sm" disabled={busy || Boolean(data.activeJob)} onClick={() => execute({ kind: "rollback", sha: release.sha })}>
                      <RotateCcw className="h-4 w-4" />
                      Przywróć
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>
      <PinDialog
        open={pending !== null}
        onCancel={() => setPending(null)}
        onSuccess={() => {
          const retry = pending;
          setPending(null);
          if (retry) void execute(retry);
        }}
      />
    </>
  );
}
```

- [ ] **Step 5: Karta w `project-detail-tabs.tsx`**

Dodaj import obok `ProjectCloudflareTunnel`:

```tsx
import { ProjectDeployEngine } from "./project-deploy-engine";
```

Zamień linię:

```tsx
      <ProjectCloudflareTunnel projectId={project.id} />
```

na:

```tsx
      <ProjectDeployEngine projectId={project.id} />
      <ProjectCloudflareTunnel projectId={project.id} />
```

- [ ] **Step 6: Typy, lint, testy, build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/agent/log-stream.ts src/app/api/deploy/logs/stream/route.ts src/app/actions/agent-deploy.ts "src/app/(dashboard)/projects/[id]/_components/project-deploy-engine.tsx" "src/app/(dashboard)/projects/[id]/_components/project-detail-tabs.tsx"
git commit -m "feat: stream agent deploy logs and add deploy engine and rollback controls"
```

---

### Task 11: Runbook etapu 2

**Files:**
- Create: `docs/runbooks/2026-09-16-stage-2-agent.md`

- [ ] **Step 1: Utwórz runbook z poniższą treścią**

````markdown
# Etap 2 — agent wdrożeń na Raspberry Pi

SSH: `ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12`
Warunek: etapy 0 i 1 wdrożone. Każdy krok wymaga zgody właściciela w chwili wykonania.

## 1. Token i pliki agenta (zgoda)

Po wdrożeniu kodu etapu 2 w `~/projects/Marczelloo-dashboard` (push `main`):

```bash
cd ~/projects/Marczelloo-dashboard
umask 077
if grep -q '^AGENT_TOKEN=' .env; then echo "AGENT_TOKEN już jest w .env — przerwij i sprawdź plik."; else
token="$(openssl rand -hex 32)"
cp .env ".env.backup-stage2-$(date +%Y%m%d-%H%M)"
printf '\nAGENT_TOKEN=%s\n' "$token" >> .env
printf 'AGENT_TOKEN=%s\nDOCKER_GID=%s\nPROJECTS_DIR=%s\n' "$token" "$(getent group docker | cut -d: -f3)" "$HOME/projects" > agent/.env
unset token
fi
grep -c '^AGENT_TOKEN=' .env agent/.env
```

Expected: `.env:1` i `agent/.env:1`.

## 2. Binaria Dockera z hosta i katalog danych (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard/agent
mkdir -p vendor ~/projects/.dashboard/agent
chmod 700 ~/projects/.dashboard/agent
cp "$(command -v docker)" vendor/docker
cp "$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')" vendor/docker-compose
ls -l vendor
```

Expected: oba pliki wykonywalne.

## 3. Budowa i start agenta (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard/agent
docker compose build
docker compose up -d
docker exec marczelloo-agent docker version --format '{{.Client.Version}} / {{.Server.Version}}'
docker exec marczelloo-agent docker compose version
docker exec marczelloo-agent git --version
docker exec marczelloo-dashboard wget -qO- http://mz-agent:8790/health
```

Expected: klient i serwer Dockera odpowiadają, `Docker Compose version v5.0.2`, wersja Git, `{"ok":true}`.
Sprawdzone 16.09.2026: host to Debian 12 (glibc 2.36), `docker` z pakietu `docker-ce-cli` wymaga GLIBC ≤ 2.34, plugin Compose jest statyczny — oba działają w `node:20-bookworm-slim`. Jeśli po aktualizacji systemu `docker version` w kontenerze zgłosi brak bibliotek: w `Dockerfile` zamień `COPY vendor/docker …` na instalację `docker-ce-cli` z repozytorium Docker dla Debiana i zbuduj ponownie (Compose zostaje z `vendor/`).

## 4. Odtworzenie dashboardu z `AGENT_TOKEN` (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard
docker compose up -d --no-build dashboard
docker exec marczelloo-dashboard sh -c 'test -n "$AGENT_TOKEN" && echo AGENT_TOKEN_OK'
```

Expected: `AGENT_TOKEN_OK`.

## 5. Pilotaż: Marczelloo-Tools (zgoda)

1. `https://dashboard.marczelloo.dev/projects/<Tools>` → karta „Silnik wdrożeń” → „Przełącz na agenta” (PIN).
2. „Deploy” → log na żywo: `Git fetch` → `Compose config` → `Build` → `Uruchomienie` → `Bramka zdrowia` → `Wynik: succeeded`.
3. Zamknij kartę przeglądarki przed końcem i sprawdź później, że wpis wdrożenia ma status `success` (dashboard dostał zdarzenie od agenta).

Weryfikacja na Pi:

```bash
docker image ls marczelloo-tools-app --format '{{.Tag}}'
docker inspect marczelloo-tools --format '{{.Config.Image}}'
ss -ltn | grep ':3202 '
curl -s -o /dev/null -w '%{http_code}\n' https://tools.marczelloo.dev/
cat ~/projects/.dashboard/agent/overrides/marczelloo-tools.yml
```

Expected: tag 12-znakowego SHA; kontener używa `marczelloo-tools-app:<sha12>`; port tylko `127.0.0.1:3202`; domena odpowiada jak przed pilotażem; override zawiera `image:` z tym tagiem.

## 6. Auto-deploy i rollback (zgoda)

1. Wypchnij drobny commit do `Marczelloo/Marczelloo-Tools` (`main`). Webhook kolejkuje zadanie z SHA z pusha; po zakończeniu karta pokazuje nową „Aktualną wersję” i poprzednią na liście.
2. Przy poprzedniej wersji kliknij „Przywróć” (PIN) → zadanie `rollback` bez builda → `succeeded`; `docker inspect marczelloo-tools --format '{{.Config.Image}}'` pokazuje tag poprzedniego SHA.
3. Wróć do najnowszej wersji: „Przywróć” przy niej albo „Deploy”.

## 7. Wycofanie pilotażu

„Wróć do skryptu” w karcie projektu. Kolejny deploy użyje starego skryptu i jego override portu. Agent może dalej działać; `docker compose -f ~/projects/Marczelloo-dashboard/agent/docker-compose.yml down` zatrzymuje go bez wpływu na aplikacje.
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-09-16-stage-2-agent.md
git commit -m "docs: add stage 2 deploy agent runbook"
```

---

## Kryteria ukończenia etapu 2

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` przechodzą.
- Na Pi agent działa (`/health`), używa Compose v5.0.2, nie publikuje portów na hoście.
- Tools wdrożony przez agenta: obraz z tagiem SHA, status wpisu `success` bez otwartej przeglądarki, audit log `deploy-agent`.
- Drugi push do Tools zastępuje zakolejkowany (jeszcze nieuruchomiony) deploy, a rollback do poprzedniej wersji kończy się `succeeded`.
- Porażka bramki zdrowia (test jednostkowy `rolls back to the previous release when the gate fails`) przywraca poprzednie wydanie i daje status `failed` z opisem rollbacku.
- Projekty bez `engine: "agent"` wdrażają się jak przed etapem 2.

## Poza zakresem (kolejne etapy)

- Tunel przez API Cloudflare, `mz-edge`, env v2 i „Zastosuj” przez agenta — etap 3.
- Przełączenie pozostałych projektów, `compose.generated.yml`, `--remove-orphans` — etap 4.
- Zastąpienie runnera w terminalu i operacjach kontenerów, decyzja o Portainerze — po etapie 4.
- Sondy per proces z `marczelloo.yml`, strumień `docker events`, polling SHA jako zapas webhooka — etapy 5–6.

## Zmiany względem planu (implementacja 16.09.2026)

- Task 1: w teście „keeps releases unchanged after a rollback” zmienna ma jawny typ `AgentState` (bez niego `tsc` zawęża `projects` do literału).
- Task 6: `exec.ts` rzutuje minimalne środowisko na `NodeJS.ProcessEnv` — typy Next.js wymagają `NODE_ENV`, którego procesy potomne celowo nie dostają.
- Task 10: `getDeployEngineAction` w trybie demo zwraca „niezarządzany” bez `requireAuth()` (użytkownik demo nie jest właścicielem; inaczej każda strona projektu w demo pokazywałaby błąd).
- Pi (tylko odczyt): Debian 12, glibc 2.36; `/usr/bin/docker` (docker-ce-cli 29.2.0) linkowany dynamicznie, wymaga GLIBC ≤ 2.34; plugin Compose v5.0.2 statyczny. Etykiety `marczelloo-tools` potwierdzają katalog projektu = katalog pliku Compose.
- Weryfikacja lokalna: proces agenta uruchomiony z atrapą dashboardu — zadanie przeszło kolejkę, `git clone` bez dostępu zakończył się błędem bez promptu, zdarzenia `started`/`finished` dotarły w kolejności z poprawnym tokenem. Obraz Dockera nie był budowany lokalnie (Docker Desktop wyłączony); buduje go runbook na Pi.

## Poprawki po przeglądzie Codexa (GPT-5.6-Sol, high, 16.09.2026)

Przyjęte:
- **Zmiana portu tunelu** — dashboard nie przepina istniejącej trasy przed deployem (stary kontener nadal ją obsługuje). `DeployTarget.tunnel.probe` mówi agentowi, czy trasa już wskazuje nowy port; tylko wtedy bramka sonduje domenę. Po sukcesie `handleAgentEvent` przełącza trasę. Nowa domena bez trasy dostaje ją od razu (`tunnelRouteState` w `src/server/agent/target.ts`).
- **Rollback przy pierwszym deployu agenta** — przed `up` agent czyta `git rev-parse HEAD`, taguje obrazy działających kontenerów SHA tego commita (`captureBaseline`) i wraca do nich, jeśli historia agenta nie odpowiada temu, co działa. `JobOutcome.baseline` trafia do historii wydań.
- **Token GitHub** — agent przy starcie zadania pobiera świeży token z `POST /api/agent/token` (uwierzytelnienie `AGENT_TOKEN`); token z żądania jest tylko zapasem. Zmienna agenta `DASHBOARD_URL` zastępuje `DASHBOARD_EVENTS_URL`.
- **`pull_policy: always`** — `up -d --no-build --pull missing`.
- **Duplikat trwającego deployu** — zadanie dla commita, który właśnie się wdraża, od razu kończy się `superseded`.
- **Idempotencja zdarzeń** — status wpisu `deploys` zapisywany na końcu, po trasie, powiadomieniach i audycie.
- **Logi > 256 KB** — `readAgentJobLogToEnd` doczytuje do końca (strumień SSE i „Check status”).

Odrzucone:
- **Build z czystego worktree** — obecny skrypt buduje w tym samym katalogu, a Compose potrzebuje `.env` i ścieżek względnych projektu. Izolowany kontekst buildu (i odcięcie plików nieśledzonych) wejdzie z rendererem w etapie 4.
