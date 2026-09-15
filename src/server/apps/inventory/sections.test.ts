import { describe, expect, it } from "vitest";
import { parseSections, sectionCommand } from "./sections";

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

describe("sectionCommand", () => {
  it("wraps the command with markers and captures its exit code", () => {
    const command = sectionCommand("env-file", "/home/Marczelloo_pi/projects/atlas-hub/.env", "cat '/x'");
    expect(command).toContain('echo "@@MZ:BEGIN env-file /home/Marczelloo_pi/projects/atlas-hub/.env"');
    expect(command).toContain("if { cat '/x' ; } >\"$mz_tmp\" 2>/dev/null; then mz_code=0; else mz_code=$?; fi");
    expect(command).toContain('echo "@@MZ:END env-file /home/Marczelloo_pi/projects/atlas-hub/.env $mz_code"');
  });

  it("rejects ids that could break the protocol", () => {
    expect(() => sectionCommand("env-file", "/path with space", "true")).toThrow();
    expect(() => sectionCommand("Env", "x", "true")).toThrow();
  });
});

describe("parseSections", () => {
  it("decodes bodies and exit codes", () => {
    const stdout = [
      "noise",
      "@@MZ:BEGIN docker-inspect all",
      b64('[{"Id":"1"}]'),
      "@@MZ:END docker-inspect all 0",
      "@@MZ:BEGIN git neobeatbuddy",
      "",
      "@@MZ:END git neobeatbuddy 128",
    ].join("\n");
    expect(parseSections(stdout)).toEqual([
      { kind: "docker-inspect", id: "all", exitCode: 0, body: '[{"Id":"1"}]' },
      { kind: "git", id: "neobeatbuddy", exitCode: 128, body: "" },
    ]);
  });

  it("fails on a truncated section", () => {
    expect(() => parseSections("@@MZ:BEGIN git x\nYWJj\n")).toThrow(/Uszkodzona/);
  });
});
