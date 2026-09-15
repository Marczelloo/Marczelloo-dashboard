import { describe, expect, it } from "vitest";
import { formatEnvValue, parseEnvEntries, parseEnvLines, updateEnvContent } from "./dotenv";

describe("parseEnvLines", () => {
  it("parses unquoted, single and double quoted values", () => {
    const entries = parseEnvEntries([
      "# comment",
      "A=plain value # trailing comment",
      "B='$2a$10$literal # not comment'",
      'C="line1\\nline2 \\"q\\""',
      "export D=exported",
      "E=",
    ].join("\n"));
    expect(entries).toEqual([
      { key: "A", value: "plain value" },
      { key: "B", value: "$2a$10$literal # not comment" },
      { key: "C", value: 'line1\nline2 "q"' },
      { key: "D", value: "exported" },
      { key: "E", value: "" },
    ]);
  });

  it("supports double-quoted values spanning lines", () => {
    expect(parseEnvEntries('KEY="-----BEGIN\nabc\n-----END"\nNEXT=1')).toEqual([
      { key: "KEY", value: "-----BEGIN\nabc\n-----END" },
      { key: "NEXT", value: "1" },
    ]);
  });

  it("keeps non-entry lines", () => {
    expect(parseEnvLines("# a\n\nnot an entry\nX=1").map((line) => line.kind)).toEqual(["other", "other", "other", "entry"]);
  });

  it("uses the last duplicate like Compose", () => {
    expect(parseEnvEntries("X=1\nX=2")).toEqual([{ key: "X", value: "2" }]);
  });
});

describe("formatEnvValue", () => {
  it("leaves safe values unquoted", () => {
    expect(formatEnvValue("https://api-atlashub.marczelloo.dev")).toBe("https://api-atlashub.marczelloo.dev");
    expect(formatEnvValue("")).toBe("");
  });

  it("single-quotes values Compose would interpolate or split", () => {
    expect(formatEnvValue("$2a$10$abc")).toBe("'$2a$10$abc'");
    expect(formatEnvValue("two words")).toBe("'two words'");
    expect(formatEnvValue("a#b")).toBe("'a#b'");
  });

  it("double-quotes multi-line or apostrophe values without dollars", () => {
    expect(formatEnvValue("it's")).toBe(`"it's"`);
    expect(formatEnvValue("a\nb")).toBe('"a\\nb"');
  });

  it("refuses values combining $ with apostrophe or newline", () => {
    expect(() => formatEnvValue("it's $5")).toThrow(/ręcznie/);
  });

  it("round-trips through the parser", () => {
    for (const value of ["$2a$10$abc", "two words", "it's", "a\nb", 'q"uote', "back\\slash", "plain"]) {
      expect(parseEnvEntries(`K=${formatEnvValue(value)}`)).toEqual([{ key: "K", value }]);
    }
  });
});

describe("updateEnvContent", () => {
  it("keeps comments, order and untouched formatting", () => {
    const original = "# AtlasHub\nA=1\nB='x y'\n\n# tail\nC=3\n";
    const next = updateEnvContent(original, [
      { key: "A", value: "1" },
      { key: "B", value: "changed $value" },
      { key: "D", value: "new" },
    ]);
    expect(next).toBe("# AtlasHub\nA=1\nB='changed $value'\n\n# tail\nD=new\n");
  });

  it("drops later duplicates of an updated key", () => {
    expect(updateEnvContent("X=1\nX=2\n", [{ key: "X", value: "3" }])).toBe("X=3\n");
  });
});
