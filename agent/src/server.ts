import { timingSafeEqual } from "node:crypto";
import http from "node:http";
import { jobRequestSchema } from "./api";
import { enqueue, rollbackRelease } from "./queue";
import { HostOperationError, type HostOperations } from "./host";
import { ConsoleError, runConsoleCommand, type ConsoleStep } from "./console";
import { runCommand as runRaw } from "./exec";
import type { FileStore } from "./store";
import type { AgentState, AgentStatus, EnvFile, Job } from "./types";

export interface ServerContext {
  token: string;
  allowedRoot: string;
  getState(): AgentState;
  mutate(change: (state: AgentState) => AgentState): void;
  store: Pick<FileStore, "readLog">;
  tokens: Map<string, string | null>;
  envFiles: Map<string, EnvFile>;
  now(): string;
  newId(): string;
  getStatus(state: AgentState): Promise<AgentStatus>;
  host: HostOperations;
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

function readBody(request: http.IncomingMessage, limit = 6_300_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("The request is too large."));
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

      if (request.method === "GET" && url.pathname === "/status") return send(response, 200, await context.getStatus(context.getState()));

      if (request.method === "GET" && url.pathname === "/host") return send(response, 200, await context.host.getHostInfo());

      if (request.method === "POST" && url.pathname === "/env-files/list") return send(response, 200, await context.host.listEnvFiles(await readBody(request)));
      if (request.method === "POST" && url.pathname === "/env-files/read") return send(response, 200, await context.host.readEnvFile(await readBody(request)));
      if (request.method === "POST" && url.pathname === "/preflight") return send(response, 200, await context.host.preflight(await readBody(request)));
      if (request.method === "POST" && url.pathname === "/containers/restart") return send(response, 200, await context.host.restartContainer(await readBody(request)));

      if (request.method === "POST" && url.pathname === "/exec") {
        try {
          return send(response, 200, await runConsoleCommand(await readBody(request), context.allowedRoot, (step: ConsoleStep, onOutput) => runRaw(step as never, onOutput)));
        } catch (error) {
          if (error instanceof ConsoleError) return send(response, 400, { error: error.message });
          throw error;
        }
      }

      if (request.method === "POST" && url.pathname === "/jobs") {
        const parsed = jobRequestSchema.safeParse(await readBody(request));
        if (!parsed.success) return send(response, 400, { error: parsed.error.issues[0]?.message ?? "Invalid request." });
        const body = parsed.data;
        if (!body.target.repoPath.startsWith(`${context.allowedRoot}/`)) {
          return send(response, 400, { error: "The repository directory must be inside the projects directory." });
        }

        let sha: string;
        if (body.kind === "deploy") {
          sha = body.sha;
        } else if (body.kind === "rollback") {
          const release = rollbackRelease(context.getState(), body.target.composeProject, body.sha ?? undefined);
          if (!release) return send(response, 409, { error: "No earlier version to restore." });
          sha = release.sha;
        } else {
          const release = context.getState().projects[body.target.composeProject]?.releases[0];
          if (!release) return send(response, 409, { error: "The project has no agent release yet. Deploy it first." });
          sha = release.sha;
        }

        const id = context.newId();
        let created: Job | null = null;
        context.mutate((state) => {
          const result = enqueue(state, { id, kind: body.kind, target: body.target, sha, deployId: body.deployId, triggeredBy: body.triggeredBy }, context.now());
          created = result.job;
          return result.state;
        });
        if (body.kind === "deploy") context.tokens.set(id, body.token);
        if (body.kind === "apply-env") context.envFiles.set(id, body.envFile);
        return send(response, 202, created);
      }

      const jobMatch = /^\/jobs\/([0-9a-f-]{36})(\/log)?$/.exec(url.pathname);
      if (request.method === "GET" && jobMatch) {
        const job = context.getState().jobs.find((candidate) => candidate.id === jobMatch[1]);
        if (!job) return send(response, 404, { error: "Job not found." });
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
      if (error instanceof HostOperationError) return send(response, error.status, { error: error.message });
      return send(response, 500, { error: error instanceof Error ? error.message : "Agent error." });
    }
  });
}
