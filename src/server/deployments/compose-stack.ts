import { shellQuote } from "@/server/runner/safe-paths";

export const SELF_COMPOSE_PROJECT = "marczelloo-dashboard";

export interface ComposeContainerInfo {
  name?: string;
  labels: Record<string, string>;
  status: string;
}

export interface ComposeStack {
  project: string;
  workingDir: string;
  configFiles: string[];
  services: string[];
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const ABSOLUTE_PATH = /^\/[A-Za-z0-9._/@+-]+$/;

function assertPath(value: string, label: string) {
  if (!ABSOLUTE_PATH.test(value) || value.split("/").includes("..")) {
    throw new Error(`Nieprawidłowa ścieżka ${label}: ${value}`);
  }
}

function invocationOf(container: ComposeContainerInfo): string {
  return `${container.labels["com.docker.compose.project.working_dir"]}|${container.labels["com.docker.compose.project.config_files"]}`;
}

/**
 * Build the stack to recreate. Containers of one project can come from
 * different Compose invocations (AtlasHub: databases were created with an
 * extra override file). When the target container is known, only services
 * created by the same invocation are recreated.
 */
export function stackFromContainers(project: string, containers: ComposeContainerInfo[], targetContainer?: string | null): ComposeStack {
  let regular = containers.filter((container) => container.labels["com.docker.compose.oneoff"] !== "True");
  const target = targetContainer ? regular.find((container) => container.name?.replace(/^\//, "") === targetContainer) : undefined;
  if (target) {
    regular = regular.filter((container) => invocationOf(container) === invocationOf(target));
  }

  const invocations = new Set(regular.map(invocationOf));
  if (invocations.size !== 1) {
    throw new Error(`Kontenery projektu ${project} pochodzą z różnych wywołań Compose — zastosuj env ręcznie.`);
  }

  const [workingDir, configFiles] = [...invocations][0].split("|");
  const services = [
    ...new Set(
      regular
        .filter((container) => container.status === "running" || container.status === "restarting")
        .map((container) => container.labels["com.docker.compose.service"])
        .filter(Boolean)
    ),
  ];
  if (!services.length) {
    throw new Error(`Projekt ${project} nie ma działających usług do odtworzenia.`);
  }

  return { project, workingDir, configFiles: configFiles.split(",").filter(Boolean), services };
}

export function buildComposeRecreateCommand(stack: ComposeStack): string {
  if (!IDENTIFIER.test(stack.project)) throw new Error("Nieprawidłowa nazwa projektu Compose.");
  assertPath(stack.workingDir, "katalogu projektu");
  stack.configFiles.forEach((file) => assertPath(file, "pliku Compose"));
  if (!stack.services.length || stack.services.some((service) => !IDENTIFIER.test(service))) {
    throw new Error("Nieprawidłowa lista usług Compose.");
  }

  const files = stack.configFiles.map((file) => `-f ${shellQuote(file)}`).join(" ");
  const services = stack.services.map(shellQuote).join(" ");
  return `docker compose -p ${shellQuote(stack.project)} --project-directory ${shellQuote(stack.workingDir)} ${files} up -d --no-build --no-deps ${services}`;
}
