import { describe, expect, it } from "vitest";
import { jsonbColumns } from "./jsonb";

describe("jsonbColumns", () => {
  it("serializes arrays and objects so pg does not send them as Postgres array literals", () => {
    const row = { id: "x", config_files: ["/a/docker-compose.yml", "/a/override.yml"], source: { git: null }, processes: [] };
    const out = jsonbColumns(row, ["config_files", "source", "processes"]);
    expect(out).toEqual({ id: "x", config_files: '["/a/docker-compose.yml","/a/override.yml"]', source: '{"git":null}', processes: "[]" });
    expect(JSON.parse(out.config_files as string)).toEqual(row.config_files);
  });

  it("keeps null and leaves other columns and the input untouched", () => {
    const row = { origin_request: null, target: { kind: "host" }, hostname: "a.b" };
    expect(jsonbColumns(row, ["origin_request", "target"])).toEqual({ origin_request: null, target: '{"kind":"host"}', hostname: "a.b" });
    expect(row.target).toEqual({ kind: "host" });
  });
});
