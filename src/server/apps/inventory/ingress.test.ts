import { describe, expect, it } from "vitest";
import { countHostnames, parseIngressConfig } from "./ingress";

const config = `tunnel: 00000000-0000-0000-0000-000000000000

ingress:
  - hostname: marczelloo.dev
    service: http://localhost:3200
  - hostname: dashboard.marczelloo.dev
    path: /api/github/webhook
    service: http://localhost:3100
  - hostname: dashboard.marczelloo.dev
    service: http://localhost:3100
  - hostname: storage-atlashub.marczelloo.dev
    service: http://127.0.0.1:9000
    originRequest:
      httpHostHeader: minio:9000

  - hostname: NadStrona.pl
    service: http://127.0.0.1:8080
  - service: http_status:404
`;

describe("parseIngressConfig", () => {
  it("keeps order, paths, origin requests and the catch-all rule", () => {
    const rules = parseIngressConfig(config);
    expect(rules).toHaveLength(6);
    expect(rules[1]).toEqual({ position: 1, hostname: "dashboard.marczelloo.dev", path: "/api/github/webhook", service: "http://localhost:3100", originRequest: null });
    expect(rules[3].originRequest).toEqual({ httpHostHeader: "minio:9000" });
    expect(rules[4].hostname).toBe("nadstrona.pl");
    expect(rules[5]).toEqual({ position: 5, hostname: null, path: null, service: "http_status:404", originRequest: null });
    expect(countHostnames(rules)).toBe(4);
  });

  it("rejects configs without ingress or with a rule missing service", () => {
    expect(() => parseIngressConfig("tunnel: x")).toThrow(/ingress/);
    expect(() => parseIngressConfig("ingress:\n  - hostname: a.pl\n")).toThrow(/service/);
  });
});
