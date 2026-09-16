import { describe, expect, it } from "vitest";
import type { DeploymentConfig } from "@/server/deployments/config";
import { toAgentTarget } from "./target";

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
  it("keeps only what the agent needs", () => {
    expect(toAgentTarget(config)).toEqual({
      projectId: config.projectId,
      composeProject: "marczelloo-tools",
      repoPath: config.repoPath,
      githubUrl: config.githubUrl,
      branch: "main",
      composeFile: null,
      profiles: [],
      tunnel: { hostname: "tools.marczelloo.dev", localPort: 3202 },
    });
  });

  it("drops a disabled tunnel", () => {
    expect(toAgentTarget({ ...config, tunnel: { enabled: false, hostname: "x.pl", localPort: 1 } }).tunnel).toBeNull();
  });
});
