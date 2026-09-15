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

export function matchStackToProject(
  stack: StackIdentity,
  projects: Array<Pick<Project, "id" | "name" | "slug" | "github_url">>,
  services: Array<Pick<Service, "project_id" | "compose_project" | "container_id">>,
  deploymentConfigs: Array<{ projectId: string; composeProject: string }>
): ProjectMatch {
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
