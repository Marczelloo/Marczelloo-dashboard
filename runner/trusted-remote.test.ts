import { describe, expect, it } from "vitest";
import { isTrustedRemote } from "./trusted-remote";

describe("isTrustedRemote", () => {
  it("accepts loopback and Docker bridge ranges", () => {
    expect(isTrustedRemote("127.0.0.1")).toBe(true);
    expect(isTrustedRemote("::1")).toBe(true);
    expect(isTrustedRemote("::ffff:172.18.0.4")).toBe(true);
    expect(isTrustedRemote("172.31.255.1")).toBe(true);
  });

  it("rejects look-alikes and other networks", () => {
    expect(isTrustedRemote("192.168.100.12")).toBe(false);
    expect(isTrustedRemote("10.172.0.1")).toBe(false);
    expect(isTrustedRemote("172.32.0.1")).toBe(false);
    expect(isTrustedRemote("::ffff:8.8.8.8")).toBe(false);
    expect(isTrustedRemote(undefined)).toBe(false);
  });
});
