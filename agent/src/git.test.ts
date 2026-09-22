import { describe, expect, it } from "vitest";
import { gitAuthEnv, gitCheckoutStep, gitSyncSteps, repositoryHttpsUrl } from "./git";

const SHA = "a".repeat(40);
const base = { repoPath: "/home/Marczelloo_pi/projects/marczelloo-tools", githubUrl: "git@github.com:Marczelloo/Marczelloo-Tools.git", sha: SHA, token: "ghs_secret" };

describe("repositoryHttpsUrl", () => {
  it("normalizes SSH and HTTPS GitHub URLs", () => {
    expect(repositoryHttpsUrl(base.githubUrl)).toBe("https://github.com/Marczelloo/Marczelloo-Tools.git");
    expect(repositoryHttpsUrl("https://github.com/Marczelloo/atlashub/")).toBe("https://github.com/Marczelloo/atlashub.git");
    expect(() => repositoryHttpsUrl("https://gitlab.com/a/b")).toThrow();
  });
});

describe("gitAuthEnv", () => {
  it("passes the token only as an extra header", () => {
    const env = gitAuthEnv("ghs_secret");
    expect(env.GIT_CONFIG_KEY_0).toBe("http.https://github.com/.extraheader");
    expect(env.GIT_CONFIG_VALUE_0).toBe(`Authorization: Basic ${Buffer.from("x-access-token:ghs_secret").toString("base64")}`);
    expect(gitAuthEnv(null)).not.toHaveProperty("GIT_CONFIG_VALUE_0");
    expect(gitAuthEnv(null).GIT_TERMINAL_PROMPT).toBe("0");
  });
});

describe("gitSyncSteps", () => {
  it("checks local changes, fetches the exact commit and checks it out detached", () => {
    const steps = gitSyncSteps({ ...base, repoExists: true });
    expect(steps.map((step) => step.args)).toEqual([
      ["-C", base.repoPath, "status", "--porcelain", "--untracked-files=no"],
      ["-C", base.repoPath, "fetch", "--no-tags", "https://github.com/Marczelloo/Marczelloo-Tools.git", SHA],
      ["-C", base.repoPath, "checkout", "--detach", SHA],
    ]);
    expect(steps[0]).toMatchObject({ quiet: true, failOnOutput: expect.stringContaining("local changes") });
    expect(JSON.stringify(steps.map((step) => step.args))).not.toContain("ghs_secret");
  });

  it("clones a missing repository first", () => {
    expect(gitSyncSteps({ ...base, repoExists: false })[0].args).toEqual(["clone", "--no-checkout", "https://github.com/Marczelloo/Marczelloo-Tools.git", base.repoPath]);
  });

  it("rejects abbreviated or invalid SHAs", () => {
    expect(() => gitSyncSteps({ ...base, sha: "abc1234", repoExists: true })).toThrow();
    expect(() => gitCheckoutStep(base.repoPath, "main")).toThrow();
  });
});
