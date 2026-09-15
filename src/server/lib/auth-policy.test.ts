import { describe, expect, it } from "vitest";
import { isOwnerEmail, isPinBypassAllowed, parseOwnerEmails } from "./auth-policy";

describe("auth-policy", () => {
  it("parses comma separated owner emails case-insensitively", () => {
    expect(parseOwnerEmails({ OWNER_EMAILS: " A@x.pl, b@y.pl ,," })).toEqual(["a@x.pl", "b@y.pl"]);
    expect(isOwnerEmail("B@Y.pl", { OWNER_EMAILS: "a@x.pl,b@y.pl" })).toBe(true);
    expect(isOwnerEmail("c@z.pl", { OWNER_EMAILS: "" })).toBe(false);
  });

  it("never bypasses the PIN in production", () => {
    expect(isPinBypassAllowed({ NODE_ENV: "production", DEV_SKIP_PIN: "true" })).toBe(false);
    expect(isPinBypassAllowed({ NODE_ENV: "development", DEV_SKIP_PIN: "true" })).toBe(true);
    expect(isPinBypassAllowed({ NODE_ENV: "development" })).toBe(false);
  });
});
