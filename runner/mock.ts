/**
 * Mock Runner Service
 *
 * Use this for local development without actual Docker/git.
 * Returns successful mock responses for all operations.
 *
 * Run with: npx tsx runner/mock.ts
 */

import http from "http";

const PORT = parseInt(process.env.RUNNER_PORT || "8787", 10);
const TOKEN = process.env.RUNNER_TOKEN || "dev-secret-token";

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

const mockResponses: Record<string, (req: RunnerRequest) => object> = {
  git_pull: (req) => ({
    success: true,
    operation: "git_pull",
    output: `Already up to date.\nUpdated ${req.target.repo_path}`,
    commit_sha: "abc1234def567890",
    duration_ms: 1234,
    timestamp: new Date().toISOString(),
  }),

  docker_restart: (req) => ({
    success: true,
    operation: "docker_restart",
    output: `${req.target.container_name || req.target.compose_project}\nContainer restarted successfully`,
    duration_ms: 2500,
    timestamp: new Date().toISOString(),
  }),

  docker_rebuild: (req) => ({
    success: true,
    operation: "docker_rebuild",
    output: [
      "Step 1/5 : FROM node:18-alpine",
      " ---> Using cache",
      "Step 2/5 : WORKDIR /app",
      " ---> Using cache",
      "Step 3/5 : COPY . .",
      " ---> 1a2b3c4d5e6f",
      "Step 4/5 : RUN npm install",
      " ---> Using cache",
      'Step 5/5 : CMD ["npm", "start"]',
      " ---> Running in abc123",
      "Successfully built abc123def456",
      `Successfully tagged ${req.target.compose_project}:latest`,
      "Creating container...",
      "Container started successfully",
    ].join("\n"),
    duration_ms: 45000,
    timestamp: new Date().toISOString(),
  }),

  compose_up: (req) => ({
    success: true,
    operation: "compose_up",
    output: `Creating network "${req.target.compose_project}_default" with the default driver\nCreating ${req.target.compose_project}_web_1 ... done`,
    duration_ms: 3000,
    timestamp: new Date().toISOString(),
  }),

  docker_logs: (req) => ({
    success: true,
    operation: "docker_logs",
    output: [
      `[${new Date(Date.now() - 60000).toISOString()}] Server starting...`,
      `[${new Date(Date.now() - 55000).toISOString()}] Connected to database`,
      `[${new Date(Date.now() - 50000).toISOString()}] Listening on port 3000`,
      `[${new Date(Date.now() - 30000).toISOString()}] GET /api/health 200 5ms`,
      `[${new Date(Date.now() - 20000).toISOString()}] GET /api/users 200 45ms`,
      `[${new Date(Date.now() - 10000).toISOString()}] POST /api/projects 201 120ms`,
      `[${new Date().toISOString()}] GET /api/health 200 3ms`,
    ].join("\n"),
    duration_ms: 150,
    timestamp: new Date().toISOString(),
  }),

  docker_status: (req) => ({
    success: true,
    operation: "docker_status",
    output: "Up 5 hours (healthy)",
    duration_ms: 50,
    timestamp: new Date().toISOString(),
  }),
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  // Log all requests
  console.log(`[MOCK] ${req.method} ${req.url}`);

  // Only accept localhost
  const remoteIp = req.socket.remoteAddress;
  if (!remoteIp?.includes("127.0.0.1") && !remoteIp?.includes("::1")) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "Forbidden: localhost only" }));
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", mode: "mock" }));
    return;
  }

  // Only POST to /execute
  if (req.method !== "POST" || req.url !== "/execute") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // Check auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== TOKEN) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  // Parse body
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

  console.log(`[MOCK] Operation: ${request.operation}`, request.target);

  // Get mock response
  const mockFn = mockResponses[request.operation];
  if (!mockFn) {
    res.writeHead(400);
    res.end(
      JSON.stringify({
        success: false,
        error: `Unknown operation: ${request.operation}`,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Simulate some delay
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

  const response = mockFn(request);
  console.log(`[MOCK] Response:`, response);

  res.writeHead(200);
  res.end(JSON.stringify(response));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("🧪 ═══════════════════════════════════════════════");
  console.log("   MOCK Runner Service");
  console.log("   ─────────────────────────────────────────────");
  console.log(`   Listening on: http://127.0.0.1:${PORT}`);
  console.log(`   Token: ${TOKEN.slice(0, 10)}...`);
  console.log("");
  console.log("   This is a MOCK service for development.");
  console.log("   All operations return fake successful responses.");
  console.log("");
  console.log("   Supported operations:");
  console.log("   - git_pull");
  console.log("   - docker_restart");
  console.log("   - docker_rebuild");
  console.log("   - compose_up");
  console.log("   - docker_logs");
  console.log("   - docker_status");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
});
