import { randomUUID } from "node:crypto";
import { parseEnvEntries } from "@/server/env/dotenv";
import type { Project, Service } from "@/types";
import { countHostnames } from "../inventory/ingress";
import { dryRunAgainstContainers, renderImportedCompose, type DryRunReport } from "../render/compose-render";
import type { GitFact, InventorySnapshot, MountFact, PortBinding } from "../types";
import { buildEnvPlan, type EnvPlanEntry } from "./env-plan";
import { matchStackToProject, type ProjectMatch } from "./match-projects";
import { matchIngressRoutes, type RouteMatch } from "./match-routes";

export interface ImportInputs {
  snapshot: InventorySnapshot;
  projects: Project[];
  services: Service[];
  legacyEnv: Array<{ projectId: string; key: string; value: string }>;
  deploymentConfigs: Array<{ projectId: string; composeProject: string }>;
}

export interface StackProposal {
  composeProject: string;
  workingDir: string | null;
  configFiles: string[];
  git: GitFact | null;
  match: ProjectMatch;
  containers: Array<{ name: string; service: string | null; image: string; status: string; ports: PortBinding[]; mounts: MountFact[] }>;
  env: EnvPlanEntry[];
  dryRun: DryRunReport | null;
  warnings: string[];
}

export interface ProposalRoute extends RouteMatch {
  projectId: string | null;
}

export interface ImportProposal {
  id: string;
  capturedAt: string;
  stacks: StackProposal[];
  routes: ProposalRoute[];
  hostnameCount: number;
  ingressError: string | null;
  projectsWithoutStack: Array<{ id: string; name: string }>;
  looseContainers: string[];
}

export type EnvPlanEntryView = Omit<EnvPlanEntry, "value" | "perService">;
export type StackProposalView = Omit<StackProposal, "env"> & { env: EnvPlanEntryView[] };
export type ImportProposalView = Omit<ImportProposal, "stacks"> & { stacks: StackProposalView[]; projects: Array<{ id: string; name: string }> };

export function buildImportProposal(inputs: ImportInputs, id: string = randomUUID()): ImportProposal {
  const { snapshot } = inputs;

  const stacks: StackProposal[] = snapshot.stacks.map((stack) => {
    const running = stack.containers.filter((container) => !container.oneOff && (container.status === "running" || container.status === "restarting"));
    const match = matchStackToProject(
      { project: stack.project, workingDir: stack.workingDir, containerNames: stack.containers.map((container) => container.name), gitRemote: stack.git?.remote ?? null },
      inputs.projects,
      inputs.services,
      inputs.deploymentConfigs
    );
    const defaultEnvPath = stack.workingDir ? `${stack.workingDir}/.env` : null;
    const env = buildEnvPlan({
      containers: running,
      imageEnv: snapshot.imageEnv,
      composeConfig: stack.composeConfig,
      envFiles: stack.envFiles
        .filter((file) => file.content !== null)
        .map((file) => ({ path: file.path, entries: parseEnvEntries(file.content!), interpolation: file.path === defaultEnvPath })),
      legacy: match.projectId ? inputs.legacyEnv.filter((entry) => entry.projectId === match.projectId).map(({ key, value }) => ({ key, value })) : [],
    });
    const dryRun = stack.composeConfig
      ? dryRunAgainstContainers(renderImportedCompose(stack.composeConfig, { project: stack.project, projectId: match.projectId ?? "unassigned" }), stack.containers, snapshot.imageEnv)
      : null;

    const warnings: string[] = [];
    if (stack.composeConfigError) warnings.push(`Nie udało się odczytać konfiguracji Compose: ${stack.composeConfigError}`);
    if (!stack.git) warnings.push("Katalog nie jest repozytorium Git — wdrożenie z GitHuba wymaga podpięcia repo.");
    if (stack.otherEnvFiles.length > 5) {
      warnings.push(`Pominięte pliki env w katalogu (${stack.otherEnvFiles.length}): ${stack.otherEnvFiles.slice(0, 5).join(", ")} i ${stack.otherEnvFiles.length - 5} innych.`);
    } else if (stack.otherEnvFiles.length) {
      warnings.push(`Pominięte pliki env w katalogu: ${stack.otherEnvFiles.join(", ")}.`);
    }
    if (stack.configFiles.some((file) => file.includes("/.dashboard/"))) {
      warnings.push("Stack używa pliku override z katalogu logów dashboardu — przy przełączeniu trafi do konfiguracji.");
    }
    const conflicted = env.filter((entry) => entry.conflicts.length && entry.include).length;
    if (conflicted) warnings.push(`${conflicted} zmiennych ma konflikty — sprawdź je przed zapisem.`);
    if (dryRun && !dryRun.ok) warnings.push("Test na sucho wykrył różnice między konfiguracją a działającymi kontenerami.");

    return {
      composeProject: stack.project,
      workingDir: stack.workingDir,
      configFiles: stack.configFiles,
      git: stack.git,
      match,
      containers: stack.containers.map((container) => ({ name: container.name, service: container.composeService, image: container.image, status: container.status, ports: container.ports, mounts: container.mounts })),
      env,
      dryRun,
      warnings,
    };
  });

  const projectByStack = new Map(stacks.map((stack) => [stack.composeProject, stack.match.projectId]));
  const allContainers = [...snapshot.stacks.flatMap((stack) => stack.containers), ...snapshot.looseContainers];
  const routes = matchIngressRoutes(snapshot.ingress.rules, allContainers).map((route) => ({
    ...route,
    projectId: route.target.kind === "container" && route.target.composeProject ? projectByStack.get(route.target.composeProject) ?? null : null,
  }));
  const matchedProjects = new Set(stacks.map((stack) => stack.match.projectId).filter(Boolean));

  return {
    id,
    capturedAt: snapshot.capturedAt,
    stacks,
    routes,
    hostnameCount: countHostnames(snapshot.ingress.rules),
    ingressError: snapshot.ingress.error,
    projectsWithoutStack: inputs.projects.filter((project) => !matchedProjects.has(project.id)).map((project) => ({ id: project.id, name: project.name })),
    looseContainers: snapshot.looseContainers.map((container) => container.name),
  };
}

export function toProposalView(proposal: ImportProposal, projects: Array<Pick<Project, "id" | "name">>): ImportProposalView {
  return {
    ...proposal,
    stacks: proposal.stacks.map((stack) => ({
      ...stack,
      env: stack.env.map(({ key, origin, sourcePath, services, secret, include, conflicts }) => ({ key, origin, sourcePath, services, secret, include, conflicts })),
    })),
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
  };
}
