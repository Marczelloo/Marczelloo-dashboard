import { describe, expect, it } from "vitest";
import type { DeploymentConfig } from "@/server/deployments/config";
import { toAgentTarget, tunnelRouteState } from "./target";

const config: DeploymentConfig = {
  version: 1,
  projectId: "11111111-1111-4111-8111-111111111111",
  githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
  branch: "main",
  repoPath: "/home/Marczelloo_pi/projects/marczelloo-tools",
  composeFile: null,
  composeProject: "marczelloo-tools",
  profiles: [],
  runtime: "web",
  exposure: "cloudflare",
  tunnel: { enabled: true, hostname: "tools.marczelloo.dev", localPort: 3202 },
  engine: "agent",
  createdAt: "t",
  updatedAt: "t",
};

describe("toAgentTarget", () => {
  it("keeps only what the agent needs and probes only when asked", () => {
    expect(toAgentTarget(config)).toEqual({
      projectId: config.projectId,
      composeProject: "marczelloo-tools",
      repoPath: config.repoPath,
      githubUrl: config.githubUrl,
      branch: "main",
      composeFile: null,
      profiles: [],
      tunnel: { hostname: "tools.marczelloo.dev", localPort: 3202, probe: false, service: null },
      generatedCompose: null,
      edge: null,
    });
    expect(toAgentTarget(config, true).tunnel?.probe).toBe(true);
  });

  it("renders a compose file for repositories built from a template", () => {
    const target = toAgentTarget({
      ...config,
      build: { kind: "node", framework: "next", packageManager: "npm", port: 3000, installCommand: "npm ci", buildCommand: "npm run build", startCommand: "npm run start", outputDir: null, dockerfile: null, composeFile: null },
    });
    expect(target.generatedCompose).toContain("dockerfile_inline");
    expect(target.generatedCompose).toContain("127.0.0.1:3202:3000");
    expect(toAgentTarget({ ...config, build: { kind: "compose", framework: null, packageManager: null, port: null, installCommand: null, buildCommand: null, startCommand: null, outputDir: null, dockerfile: null, composeFile: "compose.yml" } }).generatedCompose).toBeNull();
  });

  it("drops a disabled tunnel", () => {
    expect(toAgentTarget({ ...config, tunnel: { enabled: false, hostname: "x.pl", localPort: 1 } }).tunnel).toBeNull();
  });
});

describe("tunnelRouteState", () => {
  const tunnel = { hostname: "Tools.marczelloo.dev", localPort: 3202 };

  it("compares the existing route with the deploy port", () => {
    expect(tunnelRouteState([{ hostname: "tools.marczelloo.dev", service: "http://127.0.0.1:3202" }], tunnel)).toBe("matches");
    expect(tunnelRouteState([{ hostname: "tools.marczelloo.dev", service: "http://127.0.0.1:3000" }], tunnel)).toBe("differs");
    expect(tunnelRouteState([{ hostname: "drive.marczelloo.dev", service: "http://127.0.0.1:3202" }], tunnel)).toBe("missing");
  });
});
