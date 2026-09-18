/** Plausible container output for the public demo, where no docker host is reachable. */

import { mockContainers } from "@/lib/mock-data";

const LINES = [
  "GET /api/health 200 in 4ms",
  "GET /api/projects 200 in 38ms",
  "POST /api/deploys 202 in 61ms",
  "cache hit ratio 0.94 over 500 requests",
  "scheduled uptime sweep finished in 812ms",
  "GET /api/overview 200 in 96ms",
  "warn: upstream took 1.4s, above the 1s budget",
  "connection pool resized to 8",
  "GET /_next/static/chunks/main.js 200 in 2ms",
  "background queue drained, 0 jobs pending",
];

const BOOT = ["listening on 0.0.0.0", "loaded 14 routes", "database connection established", "ready"];

/** Deterministic per container, so a refresh in the demo does not shuffle the output. */
export function demoContainerLogs(containerId: string, tail: number, timestamps: boolean): string {
  const seed = [...containerId].reduce((total, character) => total + character.charCodeAt(0), 0);
  const count = Math.min(tail, 120);
  const now = Date.now();
  const lines: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const fromEnd = count - index;
    const at = new Date(now - fromEnd * 4_000);
    const body = index < BOOT.length ? BOOT[index] : LINES[(seed + index) % LINES.length];
    lines.push(timestamps ? `${at.toISOString()} ${body}` : body);
  }

  return lines.join("\n");
}

export function demoContainerStats(containerId: string) {
  const seed = [...containerId].reduce((total, character) => total + character.charCodeAt(0), 0);
  const memoryLimit = 1024 * 1024 * 1024;
  const memoryUsage = Math.round(memoryLimit * (0.18 + ((seed % 40) / 100)));
  return {
    cpu_percent: Number((2 + (seed % 170) / 10).toFixed(1)),
    memory_usage: memoryUsage,
    memory_limit: memoryLimit,
    memory_percent: Number(((memoryUsage / memoryLimit) * 100).toFixed(1)),
  };
}

/** A docker inspect payload for the demo, built from the mock container list. */
export function demoContainerInspect(containerId: string) {
  const container = mockContainers.find((item) => item.Id === containerId || item.Id.startsWith(containerId)) ?? mockContainers[0];
  const name = container.Names?.[0]?.replace(/^\//, "") ?? "container";
  const created = new Date(container.Created * 1000).toISOString();
  const [project, ...rest] = name.split("-");
  const service = rest.join("-");

  return {
    Id: container.Id,
    Created: created,
    Path: "/bin/sh",
    Args: ["-c", "node server.js"],
    State: {
      Status: container.State,
      Running: container.State === "running",
      Paused: false,
      Restarting: false,
      OOMKilled: false,
      Dead: false,
      Pid: container.State === "running" ? 1420 : 0,
      ExitCode: container.State === "running" ? 0 : 1,
      Error: container.State === "running" ? "" : "container exited",
      StartedAt: created,
      FinishedAt: container.State === "running" ? "0001-01-01T00:00:00Z" : new Date(Date.now() - 3 * 3_600_000).toISOString(),
    },
    Image: `sha256:${container.Id.slice(0, 32)}`,
    Name: `/${name}`,
    RestartCount: 0,
    Driver: "overlay2",
    Platform: "linux",
    Mounts: [
      { Type: "bind", Source: `/home/pi/projects/${project}`, Destination: "/app", Mode: "rw", RW: true },
      { Type: "volume", Source: `${project}_data`, Destination: "/data", Mode: "rw", RW: true },
    ],
    Config: {
      Hostname: container.Id.slice(0, 12),
      Env: ["NODE_ENV=production", "PORT=3000", "TZ=Europe/Warsaw"],
      Cmd: ["node", "server.js"],
      Image: container.Image,
      WorkingDir: "/app",
      Labels: service ? { "com.docker.compose.project": project, "com.docker.compose.service": service } : {},
    },
    NetworkSettings: {
      IPAddress: "172.19.0.4",
      Ports: Object.fromEntries(
        (container.Ports ?? []).map((port) => [
          `${port.PrivatePort}/${port.Type}`,
          port.PublicPort ? [{ HostIp: "127.0.0.1", HostPort: String(port.PublicPort) }] : null,
        ])
      ),
    },
    HostConfig: { Memory: 512 * 1024 * 1024, CpuShares: 1024, RestartPolicy: { Name: "unless-stopped", MaximumRetryCount: 0 } },
  };
}
