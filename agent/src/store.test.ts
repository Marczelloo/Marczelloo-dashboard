import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emptyState } from "./queue";
import { FileStore } from "./store";

const JOB = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER_JOB = "11111111-2222-4333-8444-555555555555";
const dirs: string[] = [];
function store() {
  const dir = mkdtempSync(path.join(tmpdir(), "mz-agent-"));
  dirs.push(dir);
  return new FileStore(dir);
}
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("FileStore", () => {
  it("returns an empty state before the first save and round-trips state", () => {
    const files = store();
    expect(files.load()).toEqual(emptyState());
    const state = { ...emptyState(), projects: { p: { releases: [] } } };
    files.save(state);
    expect(files.load()).toEqual(state);
  });

  it("appends logs and reads them from a byte offset", () => {
    const files = store();
    expect(files.readLog(JOB, 0)).toEqual({ content: "", nextOffset: 0 });
    files.appendLog(JOB, "zażółć\n");
    files.appendLog(JOB, "gęślą\n");
    const first = files.readLog(JOB, 0);
    expect(first.content).toBe("zażółć\ngęślą\n");
    files.appendLog(JOB, "jaźń\n");
    expect(files.readLog(JOB, first.nextOffset)).toEqual({ content: "jaźń\n", nextOffset: first.nextOffset + Buffer.byteLength("jaźń\n") });
  });

  it("rejects job ids that are not UUIDs", () => {
    expect(() => store().appendLog("../state", "x")).toThrow();
  });

  it("removes logs for pruned jobs while leaving other files alone", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mz-agent-"));
    dirs.push(dir);
    const files = new FileStore(dir);
    files.appendLog(JOB, "keep");
    files.appendLog(OTHER_JOB, "drop");
    const otherFile = path.join(dir, "logs", "not-a-job.log");
    writeFileSync(otherFile, "leave");

    files.pruneLogs(new Set([JOB]));

    expect(files.readLog(JOB, 0).content).toBe("keep");
    expect(existsSync(path.join(dir, "logs", `${OTHER_JOB}.log`))).toBe(false);
    expect(existsSync(otherFile)).toBe(true);
  });
});
