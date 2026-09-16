import { describe, expect, it } from "vitest";
import { localService, parseLocalPort, removeHostnameRoutes, sameIngress, upsertHostnameRoute, type TunnelIngressRule } from "./ingress";

const rules: TunnelIngressRule[] = [
  { hostname: "dashboard.marczelloo.dev", path: "/api/github/webhook", service: "http://127.0.0.1:3100", originRequest: {} },
  { hostname: "dashboard.marczelloo.dev", service: "http://127.0.0.1:3100", originRequest: {} },
  { hostname: "storage-atlashub.marczelloo.dev", service: "http://127.0.0.1:9000", originRequest: { httpHostHeader: "minio:9000" } },
  { hostname: "tools.marczelloo.dev", service: "http://127.0.0.1:3202", originRequest: {} },
  { service: "http_status:404" },
];

describe("upsertHostnameRoute", () => {
  it("changes the service in place and keeps order and originRequest", () => {
    const next = upsertHostnameRoute(rules, "Tools.marczelloo.dev", localService(3210));
    expect(next.map((rule) => rule.hostname)).toEqual(rules.map((rule) => rule.hostname));
    expect(next[3]).toEqual({ hostname: "tools.marczelloo.dev", service: "http://127.0.0.1:3210", originRequest: {} });
    expect(next[2]).toBe(rules[2]);
  });

  it("moves path rules that shared the old origin", () => {
    const next = upsertHostnameRoute(rules, "dashboard.marczelloo.dev", localService(3105));
    expect(next[0].service).toBe("http://127.0.0.1:3105");
    expect(next[1].service).toBe("http://127.0.0.1:3105");
  });

  it("inserts a new hostname before the catch-all", () => {
    const next = upsertHostnameRoute(rules, "new.nadstrona.pl", localService(3300));
    expect(next.at(-2)).toEqual({ hostname: "new.nadstrona.pl", service: "http://127.0.0.1:3300" });
    expect(next.at(-1)).toEqual({ service: "http_status:404" });
  });

  it("returns an equal list when nothing changes", () => {
    expect(sameIngress(upsertHostnameRoute(rules, "tools.marczelloo.dev", localService(3202)), rules)).toBe(true);
  });

  it("rejects unsafe input and configs without a catch-all", () => {
    expect(() => upsertHostnameRoute(rules, "bad host", localService(1))).toThrow(/domena/);
    expect(() => upsertHostnameRoute(rules.slice(0, -1), "a.pl", localService(1))).toThrow(/catch-all/);
    expect(() => localService(70000)).toThrow(/Port/);
  });
});

describe("removeHostnameRoutes", () => {
  it("removes every rule of the hostname, including path rules", () => {
    const next = removeHostnameRoutes(rules, ["DASHBOARD.marczelloo.dev"]);
    expect(next.map((rule) => rule.hostname)).toEqual(["storage-atlashub.marczelloo.dev", "tools.marczelloo.dev", undefined]);
  });
});

describe("parseLocalPort", () => {
  it("reads loopback ports only", () => {
    expect(parseLocalPort("http://127.0.0.1:3202")).toBe(3202);
    expect(parseLocalPort("http://localhost:3000/")).toBe(3000);
    expect(parseLocalPort("http://minio:9000")).toBeNull();
    expect(parseLocalPort("http_status:404")).toBeNull();
  });
});
