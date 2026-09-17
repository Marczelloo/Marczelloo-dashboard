import { describe, expect, it } from "vitest";
import { buildTargets, isMuted } from "./targets";

const config = (projectId: string, composeProject: string, hostname: string | null, engine: "agent" | "script" = "agent") => ({
  projectId,
  composeProject,
  engine,
  tunnel: hostname ? { enabled: true, hostname, localPort: 3000 } : null,
});

describe("buildTargets", () => {
  it("builds platform, container, domain and certificate targets", () => {
    const targets = buildTargets({
      ingress: [
        { hostname: "Tools.marczelloo.dev", service: "http://127.0.0.1:3202" },
        { hostname: "dashboard.marczelloo.dev", path: "/api/github/webhook", service: "http://127.0.0.1:3100" },
        { hostname: "dashboard.marczelloo.dev", service: "http://127.0.0.1:3100" },
        { hostname: "*.marczelloo.dev", service: "http://127.0.0.1:1" },
        { hostname: "nadstrona.pl", service: "http://127.0.0.1:8080" },
        { service: "http_status:404" },
      ],
      previousDomains: [],
      configs: [config("p-tools", "marczelloo-tools", "tools.marczelloo.dev"), config("p-dash", "marczelloo-dashboard", null), config("p-old", "legacy", null, "script")],
      services: [{ project_id: "p-dash", url: "https://dashboard.marczelloo.dev/login" }],
      routes: [{ hostname: "nadstrona.pl", project_id: null }],
    });

    expect(targets.map((target) => target.key)).toEqual([
      "agent",
      "disk",
      "containers:marczelloo-tools",
      "containers:marczelloo-dashboard",
      "domain:dashboard.marczelloo.dev",
      "domain:nadstrona.pl",
      "domain:tools.marczelloo.dev",
      "tls:dashboard.marczelloo.dev",
      "tls:nadstrona.pl",
      "tls:tools.marczelloo.dev",
    ]);
    expect(targets.find((target) => target.key === "domain:tools.marczelloo.dev")).toEqual({ key: "domain:tools.marczelloo.dev", kind: "domain", label: "tools.marczelloo.dev", projectId: "p-tools", composeProject: "marczelloo-tools", host: "tools.marczelloo.dev" });
    expect(targets.find((target) => target.key === "domain:dashboard.marczelloo.dev")).toMatchObject({ projectId: "p-dash", composeProject: "marczelloo-dashboard" });
    expect(targets.find((target) => target.key === "tls:nadstrona.pl")).toMatchObject({ projectId: null, composeProject: null });
    expect(targets.find((target) => target.key === "containers:marczelloo-tools")).toMatchObject({ kind: "containers", label: "marczelloo-tools", projectId: "p-tools", host: null });
  });

  it("falls back to routes imported from the old tunnel for project ownership", () => {
    const targets = buildTargets({
      ingress: [{ hostname: "api-atlashub.marczelloo.dev", service: "http://127.0.0.1:4545" }],
      previousDomains: [],
      configs: [config("p-atlas", "atlas-hub", "admin-atlashub.marczelloo.dev")],
      services: [],
      routes: [{ hostname: "api-atlashub.marczelloo.dev", project_id: "p-atlas" }],
    });
    expect(targets.find((target) => target.key === "domain:api-atlashub.marczelloo.dev")).toMatchObject({ projectId: "p-atlas", composeProject: "atlas-hub" });
  });

  it("keeps the previous domains when the tunnel configuration is unavailable", () => {
    const targets = buildTargets({ ingress: null, previousDomains: [{ host: "a.dev", projectId: "p1" }], configs: [], services: [], routes: [] });
    expect(targets.map((target) => target.key)).toEqual(["agent", "disk", "domain:a.dev", "tls:a.dev"]);
    expect(targets[2]).toMatchObject({ projectId: "p1" });
  });
});

describe("service hosts", () => {
  it("monitors public service URLs outside the tunnel and ignores local addresses", () => {
    const targets = buildTargets({
      ingress: [],
      previousDomains: [],
      configs: [],
      services: [
        { project_id: "p-web", url: "https://bookhaven.marczelloo.dev" },
        { project_id: null, url: "http://127.0.0.1:3000" },
        { project_id: null, url: "http://localhost:3000" },
        { project_id: null, url: null },
      ],
      routes: [],
    });
    expect(targets.map((target) => target.key)).toEqual(["agent", "disk", "domain:bookhaven.marczelloo.dev", "tls:bookhaven.marczelloo.dev"]);
    expect(targets[2]).toMatchObject({ projectId: "p-web" });
  });
});

describe("isMuted", () => {
  const now = Date.parse("2026-09-17T12:00:00Z");
  it("mutes during a job and for two minutes after it", () => {
    expect(isMuted({ containers: [], activeJob: { id: "j", kind: "deploy", status: "running", step: null, sha: "a".repeat(40), startedAt: null }, lastFinishedAt: null }, now)).toBe(true);
    expect(isMuted({ containers: [], activeJob: null, lastFinishedAt: "2026-09-17T11:59:00Z" }, now)).toBe(true);
    expect(isMuted({ containers: [], activeJob: null, lastFinishedAt: "2026-09-17T11:57:00Z" }, now)).toBe(false);
    expect(isMuted(undefined, now)).toBe(false);
  });
});
