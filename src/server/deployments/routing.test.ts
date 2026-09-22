import { describe, expect, it } from "vitest";
import { parseLocalPortFromService, resolveAutoDeployBranch } from "./routing";

describe("parseLocalPortFromService", () => {
  it("reads loopback ports", () => {
    expect(parseLocalPortFromService("http://127.0.0.1:3030")).toBe(3030);
    expect(parseLocalPortFromService("http://localhost:3200/")).toBe(3200);
    expect(parseLocalPortFromService("https://[::1]:9000")).toBe(9000);
  });

  it("ignores non-loopback and invalid services", () => {
    expect(parseLocalPortFromService("http://minio:9000")).toBeNull();
    expect(parseLocalPortFromService("http_status:404")).toBeNull();
    expect(parseLocalPortFromService("http://127.0.0.1:70000")).toBeNull();
  });
});

describe("resolveAutoDeployBranch", () => {
  it("deploys only the configured branch", () => {
    expect(resolveAutoDeployBranch("main", "main")).toEqual({ deploy: true, branch: "main" });
    expect(resolveAutoDeployBranch("perf/gateway", "main")).toEqual({ deploy: false, reason: "Push to perf/gateway; only main deploys automatically." });
    expect(resolveAutoDeployBranch("main", "develop")).toMatchObject({ deploy: false });
  });

  it("falls back to main/master for legacy projects", () => {
    expect(resolveAutoDeployBranch("master", null)).toEqual({ deploy: true, branch: "master" });
    expect(resolveAutoDeployBranch("feature/x", null)).toMatchObject({ deploy: false });
  });
});
