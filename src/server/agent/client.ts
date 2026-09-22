import "server-only";

import type { AgentJobRequest } from "@agent/api";
import type { AgentStatus, HostInfo, Job, PreflightResponse, Release } from "@agent/types";

const AGENT_URL = (process.env.AGENT_URL || "http://mz-agent:8790").replace(/\/+$/, "");

export function isAgentConfigured(): boolean {
  return Boolean(process.env.AGENT_TOKEN);
}

async function agentFetch<T>(pathname: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const token = process.env.AGENT_TOKEN;
  if (!token) throw new Error("The deploy agent is not configured (AGENT_TOKEN is missing).");
  const response = await fetch(`${AGENT_URL}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || `The agent answered with status ${response.status}.`);
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

/** The agent returns at most 256 KB per call; keep reading until the end of the log. */
export async function readAgentJobLogToEnd(jobId: string, offset: number, maxBytes = 8 * 1024 * 1024): Promise<{ content: string; nextOffset: number }> {
  let content = "";
  let nextOffset = offset;
  while (nextOffset - offset < maxBytes) {
    const chunk = await readAgentJobLog(jobId, nextOffset);
    if (!chunk.content || chunk.nextOffset === nextOffset) break;
    content += chunk.content;
    nextOffset = chunk.nextOffset;
  }
  return { content, nextOffset };
}

export function getAgentProject(composeProject: string): Promise<{ releases: Release[]; activeJob: Job | null }> {
  return agentFetch(`/projects/${encodeURIComponent(composeProject)}`);
}

export function getAgentStatus(): Promise<AgentStatus> {
  return agentFetch<AgentStatus>("/status");
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

/** `.env` variants in a project directory (names only). */
export function listAgentEnvFiles(repoPath: string): Promise<{ files: string[] }> {
  return agentFetch("/env-files/list", post({ repoPath }));
}

/** Contents stay server-side: callers must not log or return them without a PIN check. */
export function readAgentEnvFile(repoPath: string, filename: string): Promise<{ exists: boolean; content: string }> {
  return agentFetch("/env-files/read", post({ repoPath, filename }));
}

export function agentPreflight(repoPath: string, composeFile: string | null): Promise<PreflightResponse> {
  return agentFetch("/preflight", post({ repoPath, composeFile }), 75_000);
}

export function getAgentHost(): Promise<HostInfo> {
  return agentFetch("/host", {}, 20_000);
}

/** Restarts a Compose-managed container by name; the agent refuses anything else. */
export function restartAgentContainer(name: string): Promise<{ ok: true }> {
  return agentFetch("/containers/restart", post({ name }), 100_000);
}

/** Runs one allowlisted command in the agent container; anything else is refused there. */
export function runAgentCommand(command: string): Promise<{ command: string; code: number; stdout: string; stderr: string; durationMs: number }> {
  return agentFetch("/exec", post({ command }), 35_000);
}
