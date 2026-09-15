import { describe, expect, it } from "vitest";
import type { EnvPlanEntry } from "./env-plan";
import { buildRouteRows, envFingerprint, envKeysMetadata, envPayload, selectEnvEntries } from "./persist-rows";
import type { ProposalRoute } from "./proposal";

const entry = (key: string, value: string, include = true): EnvPlanEntry => ({ key, value, perService: null, origin: "file", sourcePath: "/p/.env", services: ["app"], secret: key.includes("SECRET"), include, conflicts: [] });

describe("env rows", () => {
  it("selects explicitly included keys only", () => {
    expect(selectEnvEntries([entry("A", "1"), entry("B", "2", false), entry("C", "3")], ["A", "B"]).map((item) => item.key)).toEqual(["A", "B"]);
  });

  it("keeps values in the payload and strips them from metadata", () => {
    const entries = [entry("JWT_SECRET", "v")];
    expect(envPayload(entries)).toEqual({ version: 1, entries: [{ key: "JWT_SECRET", value: "v", perService: null, origin: "file", sourcePath: "/p/.env", services: ["app"], secret: true }] });
    expect(JSON.stringify(envKeysMetadata(entries))).not.toContain('"v"');
  });

  it("fingerprints independent of entry order and changes with values", () => {
    const a = envFingerprint(envPayload([entry("A", "1"), entry("B", "2")]));
    expect(envFingerprint(envPayload([entry("B", "2"), entry("A", "1")]))).toBe(a);
    expect(envFingerprint(envPayload([entry("A", "1"), entry("B", "3")]))).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildRouteRows", () => {
  it("applies the user's project choice for container routes", () => {
    const routes: ProposalRoute[] = [
      { rule: { position: 0, hostname: "tools.marczelloo.dev", path: null, service: "http://127.0.0.1:3202", originRequest: null }, target: { kind: "container", composeProject: "marczelloo-tools", service: "app", containerName: "marczelloo-tools", containerPort: 3000 }, projectId: "auto" },
      { rule: { position: 1, hostname: "nadstrona.pl", path: null, service: "http://127.0.0.1:8080", originRequest: null }, target: { kind: "host", port: 8080 }, projectId: null },
    ];
    const rows = buildRouteRows(routes, new Map([["marczelloo-tools", "chosen"]]), "2026-09-16T00:00:00.000Z");
    expect(rows.map((row) => [row.position, row.project_id, row.source])).toEqual([
      [0, "chosen", "imported"],
      [1, null, "imported"],
    ]);
  });
});
