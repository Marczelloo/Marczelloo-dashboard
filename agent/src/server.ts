import { timingSafeEqual } from "node:crypto";
import http from "node:http";
import { jobRequestSchema } from "./api";
import { enqueue, rollbackRelease } from "./queue";
import type { FileStore } from "./store";
import type { AgentState, Job } from "./types";

export interface ServerContext {
  token: string;
  allowedRoot: string;
  getState(): AgentState;
  mutate(change: (state: AgentState) => AgentState): void;
  store: Pick<FileStore, "readLog">;
  tokens: Map<string, string | null>;
  now(): string;
  newId(): string;
}

function authorized(header: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function send(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function readBody(request: http.IncomingMessage, limit = 64_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Zbyt duże żądanie."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        resolve(null);
      }
    });
    request.on("error", reject);
  });
}

export function createAgentServer(context: ServerContext): http.Server {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://agent");
      if (request.method === "GET" && url.pathname === "/health") return send(response, 200, { ok: true });
      if (!authorized(request.headers.authorization, context.token)) return send(response, 401, { error: "Unauthorized" });

      if (request.method === "POST" && url.pathname === "/jobs") {
        const parsed = jobRequestSchema.safeParse(await readBody(request));
        if (!parsed.success) return send(response, 400, { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe żądanie." });
        const body = parsed.data;
        if (!body.target.repoPath.startsWith(`${context.allowedRoot}/`)) {
          return send(response, 400, { error: "Katalog repozytorium musi leżeć w katalogu projektów." });
        }

        let sha = body.sha;
        if (body.kind === "rollback") {
          const release = rollbackRelease(context.getState(), body.target.composeProject, body.sha ?? undefined);
          if (!release) return send(response, 409, { error: "Brak wcześniejszej wersji do przywrócenia." });
          sha = release.sha;
        }

        const id = context.newId();
        let created: Job | null = null;
        context.mutate((state) => {
          const result = enqueue(state, { id, kind: body.kind, target: body.target, sha: sha!, deployId: body.deployId, triggeredBy: body.triggeredBy }, context.now());
          created = result.job;
          return result.state;
        });
        context.tokens.set(id, body.kind === "deploy" ? body.token : null);
        return send(response, 202, created);
      }

      const jobMatch = /^\/jobs\/([0-9a-f-]{36})(\/log)?$/.exec(url.pathname);
      if (request.method === "GET" && jobMatch) {
        const job = context.getState().jobs.find((candidate) => candidate.id === jobMatch[1]);
        if (!job) return send(response, 404, { error: "Nie znaleziono zadania." });
        if (!jobMatch[2]) return send(response, 200, job);
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
        return send(response, 200, context.store.readLog(job.id, offset));
      }

      const projectMatch = /^\/projects\/([A-Za-z0-9][A-Za-z0-9_.-]*)$/.exec(url.pathname);
      if (request.method === "GET" && projectMatch) {
        const state = context.getState();
        const project = projectMatch[1];
        return send(response, 200, {
          releases: state.projects[project]?.releases ?? [],
          activeJob: state.jobs.find((job) => job.target.composeProject === project && (job.status === "queued" || job.status === "running")) ?? null,
        });
      }

      return send(response, 404, { error: "Not found" });
    } catch (error) {
      return send(response, 500, { error: error instanceof Error ? error.message : "Błąd agenta." });
    }
  });
}
