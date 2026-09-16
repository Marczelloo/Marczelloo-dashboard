import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyState } from "./queue";
import type { AgentState } from "./types";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class FileStore {
  private readonly statePath: string;
  private readonly logDir: string;

  constructor(dataDir: string) {
    this.statePath = path.join(dataDir, "state.json");
    this.logDir = path.join(dataDir, "logs");
    mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
  }

  load(): AgentState {
    if (!existsSync(this.statePath)) return emptyState();
    return JSON.parse(readFileSync(this.statePath, "utf8")) as AgentState;
  }

  save(state: AgentState): void {
    const temporary = `${this.statePath}.tmp`;
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporary, this.statePath);
  }

  appendLog(jobId: string, text: string): void {
    appendFileSync(this.logPath(jobId), text, { mode: 0o600 });
  }

  readLog(jobId: string, offset: number, maxBytes = 256_000): { content: string; nextOffset: number } {
    const file = this.logPath(jobId);
    if (!existsSync(file)) return { content: "", nextOffset: offset };
    const size = statSync(file).size;
    if (offset >= size) return { content: "", nextOffset: offset };
    const length = Math.min(maxBytes, size - offset);
    const buffer = Buffer.alloc(length);
    const descriptor = openSync(file, "r");
    try {
      const bytesRead = readSync(descriptor, buffer, 0, length, offset);
      return { content: buffer.subarray(0, bytesRead).toString("utf8"), nextOffset: offset + bytesRead };
    } finally {
      closeSync(descriptor);
    }
  }

  pruneLogs(keepJobIds: Set<string>): void {
    for (const entry of readdirSync(this.logDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".log")) continue;
      const jobId = entry.name.slice(0, -".log".length);
      if (JOB_ID.test(jobId) && !keepJobIds.has(jobId)) unlinkSync(path.join(this.logDir, entry.name));
    }
  }

  private logPath(jobId: string): string {
    if (!JOB_ID.test(jobId)) throw new Error("Nieprawidłowy identyfikator zadania.");
    return path.join(this.logDir, `${jobId}.log`);
  }
}
