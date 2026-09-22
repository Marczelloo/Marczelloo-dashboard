/** What the agent is doing per Compose project, as cheap to poll as the agent's /status. */
export interface ProjectActivity {
  /** Kind of the running job ("deploy", "rollback", "apply-env"), null when idle. */
  active: string | null;
  step: string | null;
  lastFinishedAt: string | null;
}

export interface AgentActivity {
  projects: Record<string, ProjectActivity>;
  /** The dashboard's own project; its restart is announced by the reload prompt instead. */
  selfProject: string | null;
}

export const ACTIVE_POLL_MS = 3_000;
export const IDLE_POLL_MS = 10_000;

/**
 * Projects whose job started or finished between two polls. Step changes are
 * ignored: they move a progress label, not what the page shows.
 */
export function changedProjects(previous: AgentActivity | null, next: AgentActivity): string[] {
  if (!previous) return [];
  const names = new Set([...Object.keys(previous.projects), ...Object.keys(next.projects)]);
  const changed: string[] = [];
  for (const name of names) {
    const before = previous.projects[name];
    const after = next.projects[name];
    if (!before || !after) continue;
    if (before.active !== after.active || before.lastFinishedAt !== after.lastFinishedAt) changed.push(name);
  }
  return changed;
}

/** A page refresh is worth it when anything but the dashboard itself changed. */
export function shouldRefresh(previous: AgentActivity | null, next: AgentActivity): boolean {
  return changedProjects(previous, next).some((name) => name !== next.selfProject);
}

export function anyActive(activity: AgentActivity | null): boolean {
  return Boolean(activity && Object.values(activity.projects).some((project) => project.active));
}

export interface JobOutcome {
  status: "queued" | "running" | "succeeded" | "failed" | "rolled_back" | "superseded";
  step: string | null;
  error: string | null;
}

export const isFinished = (outcome: JobOutcome) => outcome.status !== "queued" && outcome.status !== "running";

/** Polls one agent job until it ends; null when it could not be followed for `timeoutMs`. */
export async function waitForAgentJob(jobId: string, timeoutMs = 15 * 60_000, intervalMs = 2_000): Promise<JobOutcome | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`/api/agent/jobs/${jobId}`, { cache: "no-store" });
      if (response.ok) {
        const outcome = (await response.json()) as JobOutcome;
        if (isFinished(outcome)) return outcome;
      }
    } catch {
      // The agent or the dashboard may restart mid-job; keep asking.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}
