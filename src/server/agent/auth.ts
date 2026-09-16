import "server-only";

import { timingSafeEqual } from "node:crypto";

/** Requests from the deploy agent carry `Authorization: Bearer <AGENT_TOKEN>`. */
export function isAgentRequest(header: string | null): boolean {
  const token = process.env.AGENT_TOKEN;
  if (!token) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
