/** A believable Raspberry Pi for the public demo, in the shape the agent reports. */

import type { AgentStatus, HostInfo } from "@agent/types";
import type { HostSample } from "@/lib/host";
import { demoOverviewInputs } from "@/server/overview/demo";

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
      { container: "atlashub-api-1", hostIp: "127.0.0.1", hostPort: 3001, containerPort: 3001, protocol: "tcp" },
      { container: "dashboard-app-1", hostIp: "127.0.0.1", hostPort: 3100, containerPort: 3100, protocol: "tcp" },
      { container: "snippets-api-1", hostIp: "127.0.0.1", hostPort: 8080, containerPort: 8080, protocol: "tcp" },
      { container: "portainer", hostIp: "127.0.0.1", hostPort: 9443, containerPort: 9443, protocol: "tcp" },
    ],
  };
}

/** Ten minutes of readings before the page opened, so the charts start drawn. */
export function demoHostHistory(now = Date.now()): HostSample[] {
  return Array.from({ length: 40 }, (_, index) => {
    const wave = Math.sin(index / 4) * 0.5 + Math.sin(index / 1.7) * 0.2;
    return {
      at: now - (40 - index) * 15_000,
      load: Number((0.2 + wave * 0.06).toFixed(3)),
      memory: Number((0.46 + wave * 0.02).toFixed(3)),
      temperature: Number((48 + wave * 1.4).toFixed(1)),
    };
  });
}

export function demoAgentStatus(): AgentStatus {
  return {
    generatedAt: new Date().toISOString(),
    projects: demoOverviewInputs(new Date()).agent?.projects ?? {},
    disk: { path: "/", totalBytes: 58 * GB, freeBytes: 32 * GB },
    buildCacheBytes: Math.round(4.2 * GB),
  };
}
