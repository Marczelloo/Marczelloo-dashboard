import "server-only";

import { getAgentStatus } from "@/server/agent/client";
import { select } from "@/server/atlashub/client";
import * as monitor from "@/server/atlashub/monitor";
import { getProjects } from "@/server/atlashub/projects";
import { getServices } from "@/server/atlashub/services";
import { createUptimeCheck } from "@/server/atlashub/uptime-checks";
import { getManagedTunnelSettings, listManagedRoutes } from "@/server/cloudflare/managed-tunnel";
import { listDeploymentConfigs } from "@/server/deployments/config";
import { sendDiscordNotification } from "@/server/notifications";
import { runMonitorCycle, type CycleDependencies, type CycleResult } from "./cycle";
import { probeDomain, probeTls } from "./probes";

const UPTIME_RECORD_INTERVAL_MS = 5 * 60 * 1000;
const REFERENCE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * AtlasHub allows 100 requests a minute for the whole dashboard. Lists that
 * rarely change are read every few minutes; a failed read is not cached.
 */
function cached<T>(load: () => Promise<T>): () => Promise<T> {
  let entry: { at: number; value: T } | null = null;
  return async () => {
    if (entry && Date.now() - entry.at < REFERENCE_TTL_MS) return entry.value;
    const value = await load();
    entry = { at: Date.now(), value };
    return value;
  };
}

const dependencies: CycleDependencies = {
  now: () => new Date(),
  getAgentStatus,
  listIngress: cached(async () => (getManagedTunnelSettings() ? listManagedRoutes() : null)),
  listConfigs: cached(listDeploymentConfigs),
  listServices: cached(() => getServices({ limit: 1000 })),
  listRoutes: cached(async () => (await select<{ hostname: string | null; project_id: string | null }>("app_routes", { select: ["hostname", "project_id"], limit: 1000 })).data),
  listProjectNames: cached(async () => new Map((await getProjects({ limit: 1000 })).map((project) => [project.id, project.name]))),
  listStates: monitor.listStates,
  saveState: monitor.saveState,
  deleteState: monitor.deleteState,
  listOpenIncidents: monitor.listOpenIncidents,
  openIncident: monitor.openIncident,
  updateIncident: monitor.updateIncident,
  probeDomain,
  probeTls,
  notify: sendDiscordNotification,
  recordUptime: createUptimeCheck,
};

let running: Promise<CycleResult> | null = null;
let lastUptimeRecord = 0;

/** One cycle at a time: the scheduler, the cron endpoint and the page button share it. */
export function runMonitoring(): Promise<CycleResult> {
  if (running) return running;
  const recordUptime = Date.now() - lastUptimeRecord >= UPTIME_RECORD_INTERVAL_MS;
  if (recordUptime) lastUptimeRecord = Date.now();
  running = runMonitorCycle(dependencies, { recordUptime }).finally(() => {
    running = null;
  });
  return running;
}

export function incidentRetentionCutoff(now: Date, days: number): string {
  if (!Number.isFinite(days) || days < 1) throw new Error("Retencja musi wynosić co najmniej 1 dzień.");
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export async function pruneIncidents(now = new Date(), days = Number(process.env.MONITOR_INCIDENT_RETENTION_DAYS || 90)): Promise<number> {
  return monitor.pruneIncidents(incidentRetentionCutoff(now, days));
}
