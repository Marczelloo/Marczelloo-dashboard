/**
 * Marczelloo Dashboard Runner Service
 *
 * A standalone Node.js service that executes git and docker operations.
 * Only accepts requests from localhost with a shared secret token.
 *
 * Run with: node runner/index.js
 * Or with: npx tsx runner/index.ts
 */

import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import "dotenv/config";

const execAsync = promisify(exec);

// Configuration
const PORT = parseInt(process.env.RUNNER_PORT || "8787", 10);
const TOKEN = process.env.RUNNER_TOKEN;
// Use data directory for persistent config (mounted volume in Docker)
const DATA_DIR = process.env.RUNNER_DATA_DIR || path.join(__dirname, "data");
const ALLOWLIST_FILE = path.join(DATA_DIR, "allowlist.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!TOKEN) {
  console.error("Error: RUNNER_TOKEN environment variable is required");
  process.exit(1);
}

// Allowlist configuration - loaded from file or defaults
interface Allowlist {
  repo_paths: string[];
  compose_projects: string[];
  container_names: string[];
}

function loadAllowlist(): Allowlist {
  try {
    if (fs.existsSync(ALLOWLIST_FILE)) {
      const data = fs.readFileSync(ALLOWLIST_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load allowlist, using defaults:", e);
  }

  // Default allowlist
  return {
    repo_paths: ["/home/pi/projects/atlas-hub", "/home/pi/projects/marczelloo-dashboard"],
    compose_projects: ["atlas-hub", "marczelloo-dashboard"],
    container_names: ["atlashub-postgres", "atlashub-minio", "portainer"],
  };
}

function saveAllowlist(allowlist: Allowlist): void {
  fs.writeFileSync(ALLOWLIST_FILE, JSON.stringify(allowlist, null, 2));
}

let ALLOWLIST = loadAllowlist();

interface RunnerRequest {
  operation: string;
  target: {
    repo_path?: string;
    compose_project?: string;
    container_name?: string;
    service_name?: string;
  };
  options?: {
    tail?: number;
    build?: boolean;
  };
}

interface RunnerResponse {
  success: boolean;
  operation: string;
  output?: string;
  commit_sha?: string;
  error?: string;
  duration_ms: number;
  timestamp: string;
}

// Validate request against allowlist
function validateRequest(req: RunnerRequest): string | null {
  const { operation, target } = req;

  if (target.repo_path && !ALLOWLIST.repo_paths.includes(target.repo_path)) {
    return `Repository path not in allowlist: ${target.repo_path}`;
  }

  if (target.compose_project && !ALLOWLIST.compose_projects.includes(target.compose_project)) {
    return `Compose project not in allowlist: ${target.compose_project}`;
  }

  if (target.container_name && !ALLOWLIST.container_names.includes(target.container_name)) {
    return `Container name not in allowlist: ${target.container_name}`;
  }

  const validOperations = [
    "git_pull",
    "docker_restart",
    "docker_rebuild",
    "compose_up",
    "docker_logs",
    "docker_status",
  ];
  if (!validOperations.includes(operation)) {
    return `Invalid operation: ${operation}`;
  }

  return null;
}

// Execute operations
async function executeOperation(req: RunnerRequest): Promise<RunnerResponse> {
  const start = Date.now();
  const { operation, target, options } = req;

  try {
    let output = "";
    let commit_sha: string | undefined;

    switch (operation) {
      case "git_pull": {
        if (!target.repo_path) throw new Error("repo_path required");
        const result = await execAsync(`cd "${target.repo_path}" && git pull`);
        output = result.stdout + result.stderr;

        // Get current commit SHA
        const shaResult = await execAsync(`cd "${target.repo_path}" && git rev-parse HEAD`);
        commit_sha = shaResult.stdout.trim();
        break;
      }

      case "docker_restart": {
        const name = target.container_name || target.compose_project;
        if (!name) throw new Error("container_name or compose_project required");
        const result = await execAsync(`docker restart ${name}`);
        output = result.stdout + result.stderr;
        break;
      }

      case "docker_rebuild": {
        if (!target.compose_project) throw new Error("compose_project required");
        const service = target.service_name ? ` ${target.service_name}` : "";
        const cmd = `docker compose -p ${target.compose_project} up -d --build${service}`;
        const result = await execAsync(cmd);
        output = result.stdout + result.stderr;
        break;
      }

      case "compose_up": {
        if (!target.compose_project) throw new Error("compose_project required");
        const buildFlag = options?.build ? " --build" : "";
        const cmd = `docker compose -p ${target.compose_project} up -d${buildFlag}`;
        const result = await execAsync(cmd);
        output = result.stdout + result.stderr;
        break;
      }

      case "docker_logs": {
        const name = target.container_name || target.compose_project;
        if (!name) throw new Error("container_name or compose_project required");
        const tail = options?.tail || 100;
        const result = await execAsync(`docker logs --tail ${tail} ${name}`);
        output = result.stdout + result.stderr;
        break;
      }

      case "docker_status": {
        const name = target.container_name || target.compose_project;
        if (!name) throw new Error("container_name or compose_project required");
        const result = await execAsync(`docker ps -a --filter "name=${name}" --format "{{.Status}}"`);
        output = result.stdout.trim();
        break;
      }
    }

    return {
      success: true,
      operation,
      output,
      commit_sha,
      duration_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      operation,
      error: error instanceof Error ? error.message : "Unknown error",
      duration_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS and content type
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only accept from localhost (or Docker network)
  const remoteIp = req.socket.remoteAddress;
  const isLocal =
    remoteIp?.includes("127.0.0.1") ||
    remoteIp?.includes("::1") ||
    remoteIp?.includes("172.") ||
    remoteIp?.includes("::ffff:172.");
  if (!isLocal) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "Forbidden: localhost only" }));
    return;
  }

  const url = req.url?.split("?")[0];

  // Health check endpoint (no auth required)
  if (req.method === "GET" && url === "/health") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        status: "healthy",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Status endpoint (no auth required)
  if (req.method === "GET" && url === "/status") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        status: "running",
        uptime: process.uptime(),
        allowlist_count: {
          repos: ALLOWLIST.repo_paths.length,
          projects: ALLOWLIST.compose_projects.length,
          containers: ALLOWLIST.container_names.length,
        },
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Check auth for protected endpoints
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== TOKEN) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  // GET /allowlist - retrieve current allowlist
  if (req.method === "GET" && url === "/allowlist") {
    res.writeHead(200);
    res.end(JSON.stringify({ allowlist: ALLOWLIST }));
    return;
  }

  // PUT /allowlist - update allowlist
  if (req.method === "PUT" && url === "/allowlist") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const { allowlist } = JSON.parse(body);
      if (!allowlist || !allowlist.repo_paths || !allowlist.compose_projects || !allowlist.container_names) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid allowlist format" }));
        return;
      }

      ALLOWLIST = allowlist;
      saveAllowlist(allowlist);

      console.log(`[${new Date().toISOString()}] Allowlist updated`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, allowlist: ALLOWLIST }));
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
    return;
  }

  // POST /execute - run operations
  if (req.method === "POST" && url === "/execute") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    let request: RunnerRequest;
    try {
      request = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    // Validate against allowlist
    const validationError = validateRequest(request);
    if (validationError) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: validationError }));
      return;
    }

    // Execute and respond
    console.log(`[${new Date().toISOString()}] Executing: ${request.operation}`, request.target);
    const result = await executeOperation(request);
    console.log(
      `[${new Date().toISOString()}] Result: ${result.success ? "SUCCESS" : "FAILED"} (${result.duration_ms}ms)`
    );

    res.writeHead(result.success ? 200 : 500);
    res.end(JSON.stringify(result));
    return;
  }

  // POST /shell - execute shell commands (with safety restrictions)
  if (req.method === "POST" && url === "/shell") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const { command, cwd } = JSON.parse(body);

      if (!command || typeof command !== "string") {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "command is required" }));
        return;
      }

      // Security: Block dangerous commands
      const blockedPatterns = [
        /\brm\s+-rf\s+\/\s*$/i, // rm -rf /
        /\bmkfs\b/i, // formatting
        /\bdd\s+if=/i, // disk operations
        />\s*\/dev\//i, // writing to devices
        /\bshutdown\b/i, // shutdown commands
        /\breboot\b/i, // reboot commands
        /\bpasswd\b/i, // password changes
        /\buseradd\b/i, // user additions
        /\buserdel\b/i, // user deletions
      ];

      for (const pattern of blockedPatterns) {
        if (pattern.test(command)) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: "Command blocked for security reasons" }));
          return;
        }
      }

      // Execute with timeout using bash for proper shell handling
      const start = Date.now();
      const workingDir = cwd || process.env.HOME || "/home/pi";

      // Use bash -c for proper shell interpretation
      const shellCommand = `/bin/bash -c ${JSON.stringify(command)}`;

      const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
        exec(
          shellCommand,
          {
            cwd: workingDir,
            timeout: 60000, // 60 second timeout for longer operations
            maxBuffer: 5 * 1024 * 1024, // 5MB buffer
            env: { ...process.env, TERM: "xterm-256color", HOME: process.env.HOME || "/home/pi" },
          },
          (error, stdout, stderr) => {
            resolve({
              stdout: stdout || "",
              stderr: stderr || "",
              code: error?.code || (error ? 1 : 0),
            });
          }
        );
      });

      console.log(`[${new Date().toISOString()}] Shell: "${command}" (exit: ${result.code})`);

      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: result.code === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.code,
          cwd: workingDir,
          duration_ms: Date.now() - start,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
    return;
  }

  // Not found
  res.writeHead(404);
  res.end(
    JSON.stringify({ error: "Not found", endpoints: ["/health", "/status", "/allowlist", "/execute", "/shell"] })
  );
});

// Listen on 0.0.0.0 to allow connections from Docker network
const HOST = process.env.RUNNER_HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`🚀 Marczelloo Dashboard Runner listening on http://${HOST}:${PORT}`);
  console.log("");
  console.log("Allowlist:");
  console.log("  Repos:", ALLOWLIST.repo_paths.join(", "));
  console.log("  Projects:", ALLOWLIST.compose_projects.join(", "));
  console.log("  Containers:", ALLOWLIST.container_names.join(", "));
});
