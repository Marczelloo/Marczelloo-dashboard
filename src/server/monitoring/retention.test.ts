import { describe, expect, it } from "vitest";
import { uptimeRetentionCutoff } from "./retention";

describe("uptimeRetentionCutoff", () => {
  it("subtracts whole days in UTC", () => {
    expect(uptimeRetentionCutoff(new Date("2026-09-15T12:00:00.000Z"), 30)).toBe("2026-08-16T12:00:00.000Z");
  });

  it("rejects non-positive retention", () => {
    expect(() => uptimeRetentionCutoff(new Date(), 0)).toThrow();
  });
});
