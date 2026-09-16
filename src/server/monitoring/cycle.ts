import type { AgentStatus } from "@agent/types";
import type { TunnelIngressRule } from "@/server/cloudflare/ingress";
import type { DeploymentConfig } from "@/server/deployments/config";
import { evaluateContainers, evaluateDisk, evaluateDomain, evaluateTls } from "./evaluate";
import { advance, incidentAction, notificationFor, shouldPersist, type NotificationPayload } from "./state-machine";
import { buildTargets, isMuted } from "./targets";
import type { MonitorTarget, Observation, TargetState } from "./types";

const TLS_INTERVAL_MS = 12 * 60 * 60 * 1000;

export interface StoredTargetState extends TargetState {
  id: string;
}

export interface OpenIncident {
  id: string;
  target_key: string;
}

export interface CycleDependencies {
  now(): Date;
  getAgentStatus(): Promise<AgentStatus>;
  /** null when the managed tunnel is not configured. */
  listIngress(): Promise<TunnelIngressRule[] | null>;
  listConfigs(): Promise<DeploymentConfig[]>;
  listServices(): Promise<Array<{ id: string; project_id: string | null; url: string | null }>>;
  listRoutes(): Promise<Array<{ hostname: string | null; project_id: string | null }>>;
  listProjectNames(): Promise<Map<string, string>>;
  listStates(): Promise<StoredTargetState[]>;
  saveState(state: TargetState, id: string | null, now: string): Promise<void>;
  deleteState(id: string): Promise<void>;
  listOpenIncidents(): Promise<OpenIncident[]>;
  openIncident(input: { target_key: string; kind: string; label: string; project_id: string | null; severity: "down" | "warning"; reason: string | null; started_at: string }): Promise<void>;
  updateIncident(id: string, values: { severity?: "down" | "warning"; reason?: string | null; open?: boolean; ended_at?: string }): Promise<void>;
  probeDomain(host: string): Promise<{ statusCode: number | null; latencyMs: number; error: string | null }>;
  probeTls(host: string): Promise<{ validTo: string | null; error: string | null }>;
  notify(payload: NotificationPayload): Promise<unknown>;
  recordUptime(input: { service_id: string; status_code?: number; latency_ms?: number; ok: boolean; error?: string }): Promise<unknown>;
}

export interface CycleResult {
  checked: number;
  muted: number;
  transitions: number;
  saved: number;
  errors: string[];
}

async function settle<T>(promise: Promise<T>, errors: string[], label: string): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runMonitorCycle(deps: CycleDependencies, options: { recordUptime: boolean }): Promise<CycleResult> {
  const now = deps.now();
  const nowIso = now.toISOString();
  const errors: string[] = [];

  // Required for a meaningful cycle: without stored state or configs every target would look new.
  const [states, configs, openIncidents] = await Promise.all([deps.listStates(), deps.listConfigs(), deps.listOpenIncidents()]);
  let agentError: string | null = null;
  const [agent, ingress, services, routes, projectNames] = await Promise.all([
    deps.getAgentStatus().catch((error) => {
      agentError = errorMessage(error);
      return null;
    }),
    settle(deps.listIngress(), errors, "Cloudflare"),
    settle(deps.listServices(), errors, "services"),
    settle(deps.listRoutes(), errors, "app_routes"),
    settle(deps.listProjectNames(), errors, "projects"),
  ]);
  const ingressAvailable = ingress !== null;

  const stateByKey = new Map(states.map((state) => [state.key, state]));
  const targets = buildTargets({
    ingress: ingressAvailable ? ingress : null,
    previousDomains: states.filter((state) => state.kind === "domain").map((state) => ({ host: state.label, projectId: state.projectId })),
    configs,
    services: services ?? [],
    routes: routes ?? [],
  });

  const observe = async (target: MonitorTarget, previous: TargetState | undefined): Promise<Observation | null> => {
    switch (target.kind) {
      case "agent":
        return agent ? { outcome: "ok", detail: { generatedAt: agent.generatedAt } } : { outcome: "fail", reason: `Agent nie odpowiada: ${agentError ?? "brak danych"}`, detail: {} };
      case "disk":
        return agent?.disk ? evaluateDisk(agent.disk, agent.buildCacheBytes) : null;
      case "containers": {
        if (!agent) return null;
        const restarts = previous?.detail.restarts as Record<string, number> | undefined;
        return evaluateContainers(agent.projects[target.composeProject ?? ""]?.containers ?? [], restarts);
      }
      case "domain":
        return evaluateDomain(await deps.probeDomain(target.host!));
      case "tls": {
        const due = !previous?.lastCheckedAt || previous.status === "unknown" || now.getTime() - Date.parse(previous.lastCheckedAt) >= TLS_INTERVAL_MS;
        return due ? evaluateTls(await deps.probeTls(target.host!), now) : null;
      }
    }
  };

  const observations = await Promise.all(
    targets.map(async (target) => {
      try {
        return await observe(target, stateByKey.get(target.key));
      } catch (error) {
        errors.push(`${target.key}: ${errorMessage(error)}`);
        return null;
      }
    })
  );

  const result: CycleResult = { checked: 0, muted: 0, transitions: 0, saved: 0, errors };
  const incidentByKey = new Map(openIncidents.map((incident) => [incident.target_key, incident]));
  const domainResults = new Map<string, Observation>();

  for (const [index, target] of targets.entries()) {
    const observation = observations[index];
    if (!observation) continue;
    if (target.kind === "domain") domainResults.set(target.host!, observation);
    const previous = stateByKey.get(target.key);
    const muted = target.composeProject ? isMuted(agent?.projects[target.composeProject], now.getTime()) : false;
    const { state, transition } = advance(previous ?? null, target, observation, nowIso, { muted });
    result.checked += 1;
    if (muted) result.muted += 1;

    if (shouldPersist(previous ?? null, state, nowIso)) {
      try {
        await deps.saveState(state, previous?.id ?? null, nowIso);
        result.saved += 1;
      } catch (error) {
        errors.push(`zapis ${target.key}: ${errorMessage(error)}`);
        continue;
      }
    }
    if (!transition) continue;
    result.transitions += 1;

    const incident = incidentByKey.get(target.key);
    const severity = transition.to === "down" ? "down" : "warning";
    try {
      const action = incidentAction(transition);
      if (action === "open" && !incident) {
        await deps.openIncident({ target_key: target.key, kind: target.kind, label: target.label, project_id: target.projectId, severity, reason: transition.reason, started_at: nowIso });
      } else if ((action === "open" || action === "update") && incident) {
        await deps.updateIncident(incident.id, { severity, reason: transition.reason });
      } else if (action === "close" && incident) {
        await deps.updateIncident(incident.id, { open: false, ended_at: nowIso });
      }
    } catch (error) {
      errors.push(`incydent ${target.key}: ${errorMessage(error)}`);
    }

    const payload = notificationFor(target, transition, nowIso, target.projectId ? projectNames?.get(target.projectId) ?? null : null);
    // A failed notification must not undo the state change, or the next cycle would alert again.
    if (payload) await deps.notify(payload).catch((error) => errors.push(`powiadomienie ${target.key}: ${errorMessage(error)}`));
  }

  const targetKeys = new Set(targets.map((target) => target.key));
  for (const state of states) {
    if (targetKeys.has(state.key)) continue;
    // Without the tunnel configuration or service list a missing domain means "unknown", not "removed".
    if ((state.kind === "domain" || state.kind === "tls") && (!ingressAvailable || services === null)) continue;
    try {
      const incident = incidentByKey.get(state.key);
      if (incident) await deps.updateIncident(incident.id, { open: false, ended_at: nowIso, reason: "Cel usunięty z monitoringu" });
      await deps.deleteState(state.id);
    } catch (error) {
      errors.push(`usuwanie ${state.key}: ${errorMessage(error)}`);
    }
  }

  if (options.recordUptime && services) {
    for (const service of services) {
      let host: string | null = null;
      try {
        host = service.url ? new URL(service.url).hostname.toLowerCase() : null;
      } catch {
        host = null;
      }
      const observation = host ? domainResults.get(host) : undefined;
      if (!observation) continue;
      const statusCode = observation.detail.statusCode as number | null;
      await deps
        .recordUptime({
          service_id: service.id,
          status_code: statusCode ?? undefined,
          latency_ms: observation.detail.latencyMs as number,
          ok: observation.outcome === "ok",
          error: observation.outcome === "ok" ? undefined : observation.reason,
        })
        .catch((error) => errors.push(`uptime ${service.id}: ${errorMessage(error)}`));
    }
  }

  return result;
}
