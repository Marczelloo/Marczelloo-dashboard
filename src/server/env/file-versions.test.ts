import { describe, expect, it } from "vitest";
import { envFileFingerprint, envFileKeys, latestVersionOfFile, nextVersionNumber, versionFile, versionKeyCount } from "./file-versions";

describe("env file versions", () => {
  it("fingerprints file name and content", () => {
    expect(envFileFingerprint(".env", "A=1\n")).toBe(envFileFingerprint(".env", "A=1\n"));
    expect(envFileFingerprint(".env", "A=1\n")).not.toBe(envFileFingerprint(".env.local", "A=1\n"));
    expect(envFileFingerprint(".env", "A=1\n")).not.toBe(envFileFingerprint(".env", "A=2\n"));
  });

  it("lists keys with secret flags but never values", () => {
    const keys = envFileKeys(".env", "# c\nAPI_KEY=abc\nPORT=3000\n");
    expect(keys).toEqual({ file: ".env", keys: [{ key: "API_KEY", secret: true }, { key: "PORT", secret: false }] });
    expect(JSON.stringify(keys)).not.toContain("abc");
  });

  it("finds the newest version of a file and ignores import versions", () => {
    const versions = [
      { version: 4, fingerprint: "d", keys: { file: ".env.local", keys: [{ key: "A", secret: false }] } },
      { version: 3, fingerprint: "c", keys: { file: ".env", keys: [] } },
      { version: 1, fingerprint: "a", keys: [{ key: "A", origin: "file" }] },
    ];
    expect(latestVersionOfFile(versions, ".env")?.version).toBe(3);
    expect(versionFile(versions[2])).toBeNull();
    expect(versionKeyCount(versions[0])).toBe(1);
    expect(versionKeyCount(versions[2])).toBe(1);
    expect(nextVersionNumber(versions)).toBe(5);
    expect(nextVersionNumber([])).toBe(1);
  });
});
