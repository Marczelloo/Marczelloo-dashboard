import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("allows health, GitHub webhook and cron endpoints", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/github/webhook")).toBe(true);
    expect(isPublicPath("/api/github/webhook/")).toBe(true);
    expect(isPublicPath("/api/cron/monitoring")).toBe(true);
  });

  it("does not allow look-alike or nested paths", () => {
    expect(isPublicPath("/api/healthz")).toBe(false);
    expect(isPublicPath("/api/github/webhooks")).toBe(false);
    expect(isPublicPath("/api/github/webhook/extra")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/api/terminal")).toBe(false);
  });
});
