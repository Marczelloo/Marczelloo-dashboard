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
