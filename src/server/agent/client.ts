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
