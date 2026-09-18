import type { AgentStatus, HostInfo } from "@agent/types";
import type { Tone } from "@/lib/tone";

export interface HostAlert {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
}

export interface HostSummary {
  generatedAt: string;
  /** False when the agent is not configured or did not answer. */
  reachable: boolean;
  host: HostInfo | null;
  agent: AgentStatus | null;
  alerts: HostAlert[];
}

export const GB = 1024 ** 3;

export const percent = (used: number, total: number) => (total > 0 ? Math.round((used / total) * 100) : 0);

export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = bytes > 0 ? Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${Number((bytes / 1024 ** index).toFixed(digits))} ${units[index]}`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Load average read against the number of cores, which is how a Pi actually feels. */
export const loadPercent = (host: HostInfo) => Math.min(100, Math.round((host.loadavg[0] / Math.max(1, host.cores)) * 100));

export const memoryUsed = (host: HostInfo) => host.memory.totalBytes - host.memory.availableBytes;

export const memoryPercent = (host: HostInfo) => percent(memoryUsed(host), host.memory.totalBytes);

export const diskUsed = (host: HostInfo) => (host.disk ? host.disk.totalBytes - host.disk.freeBytes : 0);

export const diskPercent = (host: HostInfo) => (host.disk ? percent(diskUsed(host), host.disk.totalBytes) : 0);

/** A port bound to anything other than a loopback address is reachable from the LAN. */
export const isPublic = (hostIp: string) => hostIp !== "127.0.0.1" && hostIp !== "::1" && hostIp !== "localhost";

/** What the host page leads with: only what someone would act on. */
export function hostAlerts(host: HostInfo, agent: AgentStatus | null): HostAlert[] {
  const alerts: HostAlert[] = [];

  if (host.temperatureC !== null && host.temperatureC >= 70) {
    alerts.push({
      id: "temperature",
      tone: host.temperatureC >= 80 ? "err" : "warn",
      title: `CPU at ${host.temperatureC.toFixed(1)} °C`,
      detail: host.temperatureC >= 80 ? "The Pi throttles above 80 °C; check the cooling." : "Warm; watch it if this holds.",
    });
  }

  const disk = diskPercent(host);
  if (host.disk && disk >= 85) {
    alerts.push({
      id: "disk",
      tone: disk >= 92 ? "err" : "warn",
      title: `Disk ${disk}% full`,
      detail: `${formatBytes(host.disk.freeBytes)} free on ${host.disk.path}. Old images and build cache are the usual culprits.`,
    });
  }

  const memory = memoryPercent(host);
  if (memory >= 90) {
    alerts.push({ id: "memory", tone: "warn", title: `Memory ${memory}% used`, detail: `${formatBytes(host.memory.availableBytes)} available.` });
  }

  const load = loadPercent(host);
  if (load >= 90) {
    alerts.push({ id: "load", tone: "warn", title: `Load ${host.loadavg[0].toFixed(2)} over ${host.cores} cores`, detail: "Something is working the CPU hard." });
  }

  if (host.docker && host.docker.stopped > 0) {
    alerts.push({
      id: "containers",
      tone: "warn",
      title: `${host.docker.stopped} container${host.docker.stopped === 1 ? "" : "s"} stopped`,
      detail: "Start it again from the Containers tab, or remove it if it is no longer needed.",
    });
  }

  const exposed = host.publishedPorts.filter((port) => isPublic(port.hostIp));
  if (exposed.length > 0) {
    alerts.push({
      id: "ports",
      tone: "warn",
      title: `${exposed.length} port${exposed.length === 1 ? "" : "s"} open to the network`,
      detail: exposed.map((port) => `${port.hostPort} (${port.container})`).join(", "),
    });
  }

  if (agent?.buildCacheBytes && agent.buildCacheBytes > 8 * GB) {
    alerts.push({ id: "cache", tone: "warn", title: `Build cache at ${formatBytes(agent.buildCacheBytes)}`, detail: "The agent prunes it after a deploy; it is only a warning." });
  }

  return alerts;
}
