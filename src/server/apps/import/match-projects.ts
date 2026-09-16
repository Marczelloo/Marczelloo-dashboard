import type { Project, Service } from "@/types";

export interface ProjectMatch {
  projectId: string | null;
  confidence: "high" | "medium" | "none";
  reasons: string[];
}

export interface StackIdentity {
  project: string;
  workingDir: string | null;
  containerNames: string[];
  gitRemote: string | null;
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function repoKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /github\.com[/:]([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return match ? `${normalizeName(match[1])}/${normalizeName(match[2])}` : null;
}

/** Compose projects that run the platform itself (deploy agent, tunnel connector), not a dashboard project. */
export const PLATFORM_STACKS = new Set(["marczelloo-agent", "marczelloo-tunnel"]);

export function matchStackToProject(
  stack: StackIdentity,
  projects: Array<Pick<Project, "id" | "name" | "slug" | "github_url">>,
  services: Array<Pick<Service, "project_id" | "compose_project" | "container_id">>,
  deploymentConfigs: Array<{ projectId: string; composeProject: string }>
): ProjectMatch {
  if (PLATFORM_STACKS.has(stack.project)) {
    return { projectId: null, confidence: "none", reasons: ["Infrastruktura dashboardu (agent wdrożeń lub konektor tunelu) — nie jest osobnym projektem."] };
  }
  const known = new Map(projects.map((project) => [project.id, project]));
  const strong = new Map<string, string[]>();
  const weak = new Map<string, string[]>();
  const add = (target: Map<string, string[]>, projectId: string | null, reason: string) => {
    if (!projectId || !known.has(projectId)) return;
    target.set(projectId, [...new Set([...(target.get(projectId) ?? []), reason])]);
  };

  for (const config of deploymentConfigs) {
    if (config.composeProject === stack.project) add(strong, config.projectId, "Konfiguracja wdrożenia wskazuje ten stack.");
  }
  for (const service of services) {
    if (service.container_id && stack.containerNames.includes(service.container_id)) {
      add(strong, service.project_id, `Serwis wskazuje kontener ${service.container_id}.`);
    } else if (service.compose_project === stack.project) {
      add(strong, service.project_id, "Serwis wskazuje ten projekt Compose.");
    }
  }

  const remote = repoKey(stack.gitRemote);
  const directory = stack.workingDir ? normalizeName(stack.workingDir.split("/").pop() ?? "") : "";
  for (const project of projects) {
    if (remote && repoKey(project.github_url) === remote) add(strong, project.id, "Repozytorium Git zgodne z GitHubem projektu.");
    if (directory && (normalizeName(project.slug) === directory || normalizeName(project.name) === directory)) {
      add(weak, project.id, "Nazwa katalogu zgodna z projektem.");
    }
  }

  if (strong.size === 1) {
    const [projectId, reasons] = [...strong][0];
    return { projectId, confidence: "high", reasons: [...reasons, ...(weak.get(projectId) ?? [])] };
  }
  if (strong.size > 1) {
    const names = [...strong.keys()].map((id) => known.get(id)!.name).join(", ");
    return { projectId: null, confidence: "none", reasons: [`Wskazania są sprzeczne: ${names}. Wybierz projekt ręcznie.`] };
  }
  if (weak.size === 1) {
    const [projectId, reasons] = [...weak][0];
    return { projectId, confidence: "medium", reasons };
  }
  return { projectId: null, confidence: "none", reasons: ["Brak dopasowania do projektu w dashboardzie."] };
}

/**
 * One project can own only one stack. When several stacks match the same
 * project, the stack named in its deployment config keeps the match; without
 * such a config none of them is chosen automatically.
 */
export function resolveDuplicateMatches<T extends { project: string; match: ProjectMatch }>(
  stacks: T[],
  deploymentConfigs: Array<{ projectId: string; composeProject: string }>,
  projects: Array<Pick<Project, "id" | "name">>
): T[] {
  const byProject = new Map<string, T[]>();
  for (const stack of stacks) {
    if (stack.match.projectId) byProject.set(stack.match.projectId, [...(byProject.get(stack.match.projectId) ?? []), stack]);
  }
  const names = new Map(projects.map((project) => [project.id, project.name]));
  const replaced = new Map<T, ProjectMatch>();
  for (const [projectId, claimants] of byProject) {
    if (claimants.length < 2) continue;
    const configured = deploymentConfigs.find((config) => config.projectId === projectId)?.composeProject;
    const winner = claimants.find((stack) => stack.project === configured) ?? null;
    for (const stack of claimants) {
      if (stack === winner) continue;
      const reason = winner
        ? `Projekt „${names.get(projectId) ?? projectId}” należy do stacka ${winner.project} (konfiguracja wdrożenia).`
        : `Projekt „${names.get(projectId) ?? projectId}” pasuje do kilku stacków: ${claimants.map((item) => item.project).join(", ")}. Wybierz ręcznie.`;
      replaced.set(stack, { projectId: null, confidence: "none", reasons: [reason] });
    }
  }
  return stacks.map((stack) => (replaced.has(stack) ? { ...stack, match: replaced.get(stack)! } : stack));
}
