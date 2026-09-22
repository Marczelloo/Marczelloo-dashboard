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
  /** Images of the version that was live before this deploy, tagged by the agent. */
  baseline: Release | null;
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
  const job: Job = { ...input, status: "queued", createdAt: now, startedAt: null, finishedAt: null, error: null, rolledBackTo: null, step: null };
  const running = state.jobs.find(
    (candidate) => candidate.status === "running" && candidate.kind === "deploy" && candidate.target.composeProject === input.target.composeProject && candidate.sha === input.sha
  );
  if (input.kind === "deploy" && running) {
    // A redelivered webhook or a double click must not rebuild the commit being deployed.
    const duplicate: Job = { ...job, status: "superseded", finishedAt: now, error: `This commit is already deploying (job ${running.id}).` };
    return { state: prune({ ...state, jobs: [...state.jobs, duplicate], outbox: [...state.outbox, eventFor(duplicate, "job.finished", now)] }), job: duplicate };
  }
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
    const closed: Job = { ...candidate, status: "superseded", finishedAt: now, error: `Replaced by newer commit ${input.sha.slice(0, 7)}.` };
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

/** Records which pipeline step a running job is on, for the dashboard's deploy progress. */
export function setJobStep(state: AgentState, jobId: string, step: string | null): AgentState {
  const current = state.jobs.find((job) => job.id === jobId);
  if (!current || current.status !== "running" || (current.step ?? null) === step) return state;
  return { ...state, jobs: updateJob(state, jobId, (job) => ({ ...job, step })).jobs };
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
    step: null,
  }));
  const project = job.target.composeProject;
  let releases = state.projects[project]?.releases ?? [];
  if (outcome.baseline) releases = recordRelease(releases, outcome.baseline);
  if (outcome.release) releases = recordRelease(releases, outcome.release);
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
    const failed: Job = { ...job, status: "failed", finishedAt: now, error: "The agent restarted during the job. Deploy again." };
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
