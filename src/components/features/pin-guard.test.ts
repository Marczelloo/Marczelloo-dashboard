import { describe, expect, it } from "vitest";
import { needsPin } from "./pin-guard";

describe("needsPin", () => {
  it("detects both PIN signals", () => {
    expect(needsPin({ success: false, requirePin: true })).toBe(true);
    expect(needsPin({ success: false, error: "PIN verification required" })).toBe(true);
  });

  it("ignores other outcomes", () => {
    expect(needsPin({ success: true })).toBe(false);
    expect(needsPin({ success: false, error: "This action is disabled in demo mode" })).toBe(false);
  });
});
