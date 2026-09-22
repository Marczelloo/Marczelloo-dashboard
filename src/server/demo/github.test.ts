import { describe, expect, it } from "vitest";
import {
  demoGithubData,
  demoRepoFromParams,
  listDemoGithubRepos,
} from "./github";

describe("demo GitHub data", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  it("is deterministic for a supplied clock and has stable GitHub shapes", () => {
    const first = demoGithubData(now);
    const second = demoGithubData(now);
    expect(first).toEqual(second);
    expect(first.dashboard.repository.full_name).toBe("marczelloo/dashboard");
    expect(first.dashboard.commits).toHaveLength(15);
    expect(first.dashboard.contents["README.md"]).toMatchObject({
      type: "file",
      encoding: "base64",
      path: "README.md",
    });
    expect(listDemoGithubRepos({ page: 1, perPage: 2 }, now)).toMatchObject({
      data: expect.any(Array),
      pagination: { totalCount: 4, nextPage: 2 },
    });
  });
  it("returns null for a repository outside the demo fixtures", async () => {
    await expect(
      demoRepoFromParams(
        Promise.resolve({ owner: "marczelloo", repo: "missing" }),
      ),
    ).resolves.toBeNull();
    await expect(
      demoRepoFromParams(
        Promise.resolve({ owner: "someone-else", repo: "dashboard" }),
      ),
    ).resolves.toBeNull();
  });
});
