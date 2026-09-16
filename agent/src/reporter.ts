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
