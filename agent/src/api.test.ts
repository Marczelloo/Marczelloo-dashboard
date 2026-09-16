import { describe, expect, it } from "vitest";
import { jobRequestSchema } from "./api";

const target = {
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject: "marczelloo-tools",
  repoPath: "/home/Marczelloo_pi/projects/marczelloo-tools",
  githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
  branch: "main",
  composeFile: null,
  profiles: [],
  tunnel: null,
};

const request = {
  kind: "apply-env",
  target,
  deployId: "22222222-2222-4222-8222-222222222222",
  triggeredBy: "tester",
  envFile: { name: "env/prod.env", content: "APP_KEY=value", previous: null },
};

describe("jobRequestSchema apply-env", () => {
  it("accepts a valid env file request", () => {
    expect(jobRequestSchema.safeParse(request).success).toBe(true);
  });

  it.each(["../x", "/tmp/env", "a".repeat(201)])("rejects an unsafe or too-long file name: %s", (name) => {
    expect(jobRequestSchema.safeParse({ ...request, envFile: { ...request.envFile, name } }).success).toBe(false);
  });

  it("rejects content above the configured limit", () => {
    expect(jobRequestSchema.safeParse({ ...request, envFile: { ...request.envFile, content: "x".repeat(512_001) } }).success).toBe(false);
  });
});
