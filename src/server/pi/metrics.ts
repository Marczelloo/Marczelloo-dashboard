import type { HostInfo } from "@agent/types";

export interface PiMetrics {
  hostname: string;
  uptime: string;
  cpu: { usage: number; cores: number; load1: number; load5: number; load15: number };
  memory: { total: number; used: number; free: number; available: number; usagePercent: number };
  disk: { total: string; used: string; available: string; usagePercent: number; mount: string };
  temperature: number | null;
  docker: { containersRunning: number; containersStopped: number; imagesCount: number };
  network: { ip: string };
}

const MB = 1024 * 1024;

function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)}G`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const parts = [days && `${days} ${days === 1 ? "day" : "days"}`, hours && `${hours} ${hours === 1 ? "hour" : "hours"}`, `${minutes} ${minutes === 1 ? "minute" : "minutes"}`];
  return parts.filter(Boolean).join(", ");
}

/** Maps the agent's host report onto the shape the Pi page has always rendered. */
export function toPiMetrics(host: HostInfo): PiMetrics {
  const [load1, load5, load15] = host.loadavg;
  const total = Math.round(host.memory.totalBytes / MB);
  const available = Math.round(host.memory.availableBytes / MB);
  const disk = host.disk;
  const diskUsed = disk ? disk.totalBytes - disk.freeBytes : 0;
  return {
    hostname: host.hostname,
    uptime: formatUptime(host.uptimeSeconds),
    cpu: { usage: Math.min(100, Math.round((load1 / Math.max(1, host.cores)) * 100)), cores: host.cores, load1, load5, load15 },
    memory: { total, used: total - available, free: available, available, usagePercent: total > 0 ? Math.round(((total - available) / total) * 100) : 0 },
    disk: disk
      ? { total: gigabytes(disk.totalBytes), used: gigabytes(diskUsed), available: gigabytes(disk.freeBytes), usagePercent: disk.totalBytes > 0 ? Math.round((diskUsed / disk.totalBytes) * 100) : 0, mount: disk.path }
      : { total: "—", used: "—", available: "—", usagePercent: 0, mount: "/" },
    temperature: host.temperatureC,
    docker: { containersRunning: host.docker?.running ?? 0, containersStopped: host.docker?.stopped ?? 0, imagesCount: host.docker?.images ?? 0 },
    // The agent runs in a container and cannot see the host's LAN address.
    network: { ip: "—" },
  };
}
