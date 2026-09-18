import "server-only";

import { isDemoMode } from "@/lib/demo-mode";
import * as monitor from "@/server/atlashub/monitor";
import { projects, services, uptimeChecks } from "@/server/data";
import { demoOverviewInputs } from "@/server/overview/demo";
import { ttlCache } from "@/server/lib/ttl-cache";
import type { MonitorIncident } from "@/server/atlashub/monitor";
import type { MonitorKind, MonitorStatus, TargetState } from "@/server/monitoring/types";

export interface MonitorTargetRow {
  key: string;
  kind: MonitorKind;
  label: string;
  projectId: string | null;
  projectName: string | null;
  status: MonitorStatus;
  since: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  sslDaysLeft: number | null;
  freePercent: number | null;
  containers: Array<{ name: string; status: string; restartCount: number }>;
}

export interface MonitoredService {
  id: string;
  name: string;
  url: string | null;
  uptime: number;
  avgLatency: number;
  checks: number;
  lastOk: boolean;
  lastCheckedAt: string | null;
  sslDaysLeft: number | null;
}

export interface MonitorSummary {
  generatedAt: string;
  /** Domains and container groups, the things a project is judged by. */
  targets: MonitorTargetRow[];
  /** The agent and the disk: one row each, never grouped under a project. */
  platform: MonitorTargetRow[];
  incidents: MonitorIncident[];
  services: MonitoredService[];
}

const number = (value: unknown): number | null => (typeof value === "number" ? value : null);

function toRow(state: TargetState, names: Map<string, string>, tls: Map<string, TargetState>): MonitorTargetRow {
  const certificate = tls.get(state.label);
  return {
    key: state.key,
    kind: state.kind,
    label: state.label,
    projectId: state.projectId,
    projectName: state.projectId ? (names.get(state.projectId) ?? null) : null,
    status: state.status,
    since: state.since,
    lastCheckedAt: state.lastCheckedAt,
    lastError: state.lastError,
    latencyMs: number(state.detail.latencyMs),
    sslDaysLeft: certificate ? number(certificate.detail.daysLeft) : null,
    freePercent: number(state.detail.freePercent),
    containers: (state.detail.containers as MonitorTargetRow["containers"] | undefined) ?? [],
  };
}

async function load(): Promise<MonitorSummary> {
  const now = new Date();
  const [states, incidents, allProjects, monitored] = await Promise.all([
    isDemoMode() ? Promise.resolve(demoOverviewInputs(now).states) : monitor.listStates(),
    isDemoMode() ? Promise.resolve(demoOverviewInputs(now).incidents) : monitor.listRecentIncidents(20),
    projects.getProjects({ limit: 1000 }).catch(() => []),
    services.getMonitorableServices().catch(() => []),
  ]);

  const names = new Map(allProjects.map((project) => [project.id, project.name]));
  const tls = new Map(states.filter((state) => state.kind === "tls").map((state) => [state.label, state]));

  const rows = states.filter((state) => state.kind === "domain" || state.kind === "containers").map((state) => toRow(state, names, tls));
  const platform = states.filter((state) => state.kind === "agent" || state.kind === "disk").map((state) => toRow(state, names, tls));

  const withStats = await Promise.all(
    monitored.map(async (service) => {
      const [stats, latest] = await Promise.all([
        uptimeChecks.getUptimeStats(service.id, 24).catch(() => ({ uptime: 0, avgLatency: 0, checks: 0, lastOk: false })),
        uptimeChecks.getLatestCheckByServiceId(service.id).catch(() => null),
      ]);
      return {
        id: service.id,
        name: service.name,
        url: service.url,
        uptime: stats.uptime,
        avgLatency: stats.avgLatency,
        checks: stats.checks,
        lastOk: stats.lastOk,
        lastCheckedAt: latest?.checked_at ?? null,
        sslDaysLeft: latest?.ssl_days_left ?? null,
      };
    })
  );

  return { generatedAt: now.toISOString(), targets: rows, platform, incidents, services: withStats };
}

/** Cached briefly: the monitoring loop writes at most once a minute anyway. */
const cached = ttlCache(20_000, load);

export const getMonitorSummary = (): Promise<MonitorSummary> => cached();

/** Worst first, then by name, so a problem is never below the fold. */
const RANK: Record<MonitorStatus, number> = { down: 0, warning: 1, unknown: 2, ok: 3 };

export function sortTargets(rows: MonitorTargetRow[]): MonitorTargetRow[] {
  return [...rows].sort((a, b) => RANK[a.status] - RANK[b.status] || a.label.localeCompare(b.label));
}

export function groupByProject(rows: MonitorTargetRow[]): Array<{ name: string; rows: MonitorTargetRow[] }> {
  const groups = new Map<string, MonitorTargetRow[]>();
  for (const row of sortTargets(rows)) {
    const name = row.projectName ?? "Without a project";
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  const worst = (rows: MonitorTargetRow[]) => Math.min(...rows.map((row) => RANK[row.status]));
  return [...groups.entries()]
    .map(([name, rows]) => ({ name, rows }))
    .sort((a, b) => worst(a.rows) - worst(b.rows) || a.name.localeCompare(b.name));
}
