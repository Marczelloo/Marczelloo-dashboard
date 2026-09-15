import { createHash } from "node:crypto";
import type { GitFact, PortBinding } from "../types";
import type { EnvPlanEntry } from "./env-plan";
import type { RouteTarget } from "./match-routes";
import type { ProposalRoute, StackProposal } from "./proposal";

export interface EnvVersionPayload {
  version: 1;
  entries: Array<Pick<EnvPlanEntry, "key" | "value" | "perService" | "origin" | "sourcePath" | "services" | "secret">>;
}

export interface AppConfigRowInput {
  project_id: string;
  compose_project: string;
  working_dir: string | null;
  config_files: string[];
  state: "imported";
  source: { git: GitFact | null };
  processes: Array<{ service: string | null; container: string; image: string; ports: PortBinding[] }>;
  auto_deploy: false;
  updated_at: string;
}

export interface AppRouteRowInput {
  project_id: string | null;
  position: number;
  hostname: string | null;
  path: string | null;
  service: string;
  origin_request: Record<string, unknown> | null;
  target: RouteTarget;
  source: "imported";
  created_at: string;
  updated_at: string;
}

export function selectEnvEntries(plan: EnvPlanEntry[], includeKeys: string[]): EnvPlanEntry[] {
  const wanted = new Set(includeKeys);
  return plan.filter((entry) => wanted.has(entry.key));
}

export function envPayload(entries: EnvPlanEntry[]): EnvVersionPayload {
  return {
    version: 1,
    entries: entries.map(({ key, value, perService, origin, sourcePath, services, secret }) => ({ key, value, perService, origin, sourcePath, services, secret })),
  };
}

export function envKeysMetadata(entries: EnvPlanEntry[]) {
  return entries.map(({ key, origin, sourcePath, services, secret, conflicts }) => ({ key, origin, sourcePath, services, secret, conflicts }));
}

export function envFingerprint(payload: EnvVersionPayload): string {
  const canonical = [...payload.entries]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => [entry.key, entry.value, entry.perService ? Object.entries(entry.perService).sort() : null]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function buildAppConfigRow(stack: StackProposal, projectId: string, now: string): AppConfigRowInput {
  return {
    project_id: projectId,
    compose_project: stack.composeProject,
    working_dir: stack.workingDir,
    config_files: stack.configFiles,
    state: "imported",
    source: { git: stack.git },
    processes: stack.containers.map((container) => ({ service: container.service, container: container.name, image: container.image, ports: container.ports })),
    auto_deploy: false,
    updated_at: now,
  };
}

export function buildRouteRows(routes: ProposalRoute[], projectOverrides: Map<string, string | null>, now: string): AppRouteRowInput[] {
  return routes.map((route) => {
    const composeProject = route.target.kind === "container" ? route.target.composeProject : null;
    const projectId = composeProject && projectOverrides.has(composeProject) ? projectOverrides.get(composeProject)! : route.projectId;
    return {
      project_id: route.target.kind === "container" ? projectId : null,
      position: route.rule.position,
      hostname: route.rule.hostname,
      path: route.rule.path,
      service: route.rule.service,
      origin_request: route.rule.originRequest,
      target: route.target,
      source: "imported",
      created_at: now,
      updated_at: now,
    };
  });
}
