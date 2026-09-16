import { describe, expect, it } from "vitest";
import { fetchCloneToken } from "./dashboard";

const PROJECT = "11111111-1111-4111-8111-111111111111";

describe("fetchCloneToken", () => {
  it("asks the dashboard for a fresh repository token", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ token: "ghs_fresh" }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await fetchCloneToken("http://dashboard:3100", "secret", PROJECT, fake)).toBe("ghs_fresh");
    expect(calls[0].url).toBe("http://dashboard:3100/api/agent/token");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ projectId: PROJECT });
  });

  it("returns null when the dashboard is unavailable or has no token", async () => {
    const offline = (async () => Promise.reject(new Error("down"))) as unknown as typeof fetch;
    const empty = (async () => new Response(JSON.stringify({ token: null }), { status: 200 })) as unknown as typeof fetch;
    const error = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    expect(await fetchCloneToken("http://dashboard:3100", "secret", PROJECT, offline)).toBeNull();
    expect(await fetchCloneToken("http://dashboard:3100", "secret", PROJECT, empty)).toBeNull();
    expect(await fetchCloneToken("http://dashboard:3100", "secret", PROJECT, error)).toBeNull();
  });
});
