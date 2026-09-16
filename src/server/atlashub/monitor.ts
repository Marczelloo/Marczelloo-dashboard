import "server-only";

import type { MonitorKind, MonitorStatus, TargetState } from "@/server/monitoring/types";
import * as db from "./client";
import { jsonbColumns } from "./jsonb";

interface StateRow {
  id: string;
  key: string;
  kind: MonitorKind;
  label: string;
  project_id: string | null;
  status: MonitorStatus;
  fail_count: number;
  since: string;
  last_checked_at: string | null;
  last_error: string | null;
  detail: Record<string, unknown> | null;
  updated_at: string;
}

export interface MonitorIncident {
  id: string;
  target_key: string;
  kind: MonitorKind;
  label: string;
  project_id: string | null;
  severity: "down" | "warning";
  reason: string | null;
  open: boolean;
  started_at: string;
  ended_at: string | null;
}

export type StoredState = TargetState & { id: string };

function fromRow(row: StateRow): StoredState {
  return {
    id: row.id,
    key: row.key,
    kind: row.kind,
    label: row.label,
    projectId: row.project_id,
    status: row.status,
    failCount: row.fail_count,
    since: row.since,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    detail: row.detail ?? {},
  };
}

function toRow(state: TargetState, now: string) {
  return jsonbColumns(
    {
      key: state.key,
      kind: state.kind,
      label: state.label,
      project_id: state.projectId,
      status: state.status,
      fail_count: state.failCount,
      since: state.since,
      last_checked_at: state.lastCheckedAt,
      last_error: state.lastError,
      detail: state.detail,
      updated_at: now,
    },
    ["detail"]
  );
}

export async function listStates(): Promise<StoredState[]> {
  const response = await db.select<StateRow>("monitor_state", { limit: 1000 });
  return response.data.map(fromRow);
}

export async function saveState(state: TargetState, id: string | null, now: string): Promise<void> {
  if (id) await db.updateById("monitor_state", id, toRow(state, now));
  else await db.insert("monitor_state", toRow(state, now));
}

export async function deleteState(id: string): Promise<void> {
  await db.deleteById("monitor_state", id);
}

export async function listOpenIncidents(): Promise<MonitorIncident[]> {
  const response = await db.select<MonitorIncident>("monitor_incidents", { filters: [{ operator: "eq", column: "open", value: true }], limit: 1000 });
  return response.data;
}

export async function listRecentIncidents(limit = 50): Promise<MonitorIncident[]> {
  const response = await db.select<MonitorIncident>("monitor_incidents", { order: { column: "started_at", direction: "desc" }, limit });
  return response.data;
}

export async function openIncident(input: Omit<MonitorIncident, "id" | "open" | "ended_at">): Promise<void> {
  await db.insert("monitor_incidents", { ...input, open: true, ended_at: null });
}

export async function updateIncident(id: string, values: Partial<Pick<MonitorIncident, "severity" | "reason" | "open" | "ended_at">>): Promise<void> {
  await db.updateById("monitor_incidents", id, values);
}

export async function pruneIncidents(cutoff: string): Promise<number> {
  const result = await db.deleteRows("monitor_incidents", [
    { operator: "eq", column: "open", value: false },
    { operator: "lt", column: "ended_at", value: cutoff },
  ]);
  return result.deletedCount;
}
