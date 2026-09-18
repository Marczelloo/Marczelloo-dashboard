/** A believable Raspberry Pi for the public demo, in the shape the agent reports. */

import type { AgentStatus, HostInfo } from "@agent/types";

const GB = 1024 ** 3;

export function demoHostInfo(): HostInfo {
  // Small deterministic wobble so the live charts are not a flat line.
  const tick = Math.floor(Date.now() / 15_000) % 12;
  const load = 0.72 + tick * 0.035;
  return {
    hostname: "raspberrypi",
    uptimeSeconds: 45 * 86_400 + 3 * 3_600 + 12 * 60,
    loadavg: [Number(load.toFixed(2)), Number((load * 0.86).toFixed(2)), Number((load * 0.71).toFixed(2))],
    cores: 4,
    memory: { totalBytes: Math.round(3.81 * GB), availableBytes: Math.round((2.06 - tick * 0.01) * GB) },
    disk: { path: "/", totalBytes: 58 * GB, freeBytes: 32 * GB },
    temperatureC: Number((47.5 + tick * 0.3).toFixed(1)),
    docker: { running: 5, stopped: 1, images: 12 },
    publishedPorts: [
      { container: "atlashub-api", hostIp: "127.0.0.1", hostPort: 3001, containerPort: 3001, protocol: "tcp" },
      { container: "atlashub-postgres", hostIp: "127.0.0.1", hostPort: 5432, containerPort: 5432, protocol: "tcp" },
      { container: "dashboard-app", hostIp: "127.0.0.1", hostPort: 3100, containerPort: 3000, protocol: "tcp" },
      { container: "mewbit-lavalink", hostIp: "127.0.0.1", hostPort: 2333, containerPort: 2333, protocol: "tcp" },
      { container: "portainer", hostIp: "0.0.0.0", hostPort: 9443, containerPort: 9443, protocol: "tcp" },
    ],
  };
}

export function demoAgentStatus(): AgentStatus {
  return {
    generatedAt: new Date().toISOString(),
    projects: {},
    disk: { path: "/", totalBytes: 58 * GB, freeBytes: 32 * GB },
    buildCacheBytes: Math.round(4.2 * GB),
  };
}
