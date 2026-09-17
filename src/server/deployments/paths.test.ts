import { describe, expect, it } from "vitest";
import { getEnvFilePath, shellQuote, validateRepoPath } from "./paths";

describe("safe-paths", () => {
  it("quotes single quotes for POSIX shells", () => {
    expect(shellQuote("a'b")).toBe(`'a'"'"'b'`);
  });

  it("accepts paths below the projects directory", () => {
    expect(validateRepoPath("/home/Marczelloo_pi/projects/atlas-hub/")).toBe("/home/Marczelloo_pi/projects/atlas-hub");
  });

  it("rejects traversal and foreign roots", () => {
    expect(() => validateRepoPath("/home/Marczelloo_pi/projects/../.ssh")).toThrow();
    expect(() => validateRepoPath("/etc")).toThrow();
  });

  it("accepts only .env style file names", () => {
    expect(getEnvFilePath("/home/Marczelloo_pi/projects/x", ".env.live").filePath).toBe("/home/Marczelloo_pi/projects/x/.env.live");
    expect(() => getEnvFilePath("/home/Marczelloo_pi/projects/x", "../.env")).toThrow();
  });
});
