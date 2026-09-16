/**
 * GitHub App installation tokens expire after an hour and are lost when the
 * agent restarts, so a fresh repository-scoped token is requested when a job starts.
 */
export async function fetchCloneToken(dashboardUrl: string, agentToken: string, projectId: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(`${dashboardUrl.replace(/\/+$/, "")}/api/agent/token`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ projectId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { token?: unknown };
    return typeof body.token === "string" && body.token ? body.token : null;
  } catch {
    return null;
  }
}
