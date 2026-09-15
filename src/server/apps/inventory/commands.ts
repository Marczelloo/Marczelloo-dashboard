import { shellQuote } from "@/server/runner/safe-paths";
import type { GitFact } from "../types";
import { sectionCommand } from "./sections";

export const IMAGE_ID = /^sha256:[0-9a-f]{64}$/;

export interface StackLocation {
  project: string;
  workingDir: string;
  configFiles: string[];
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const PATH = /^\/[A-Za-z0-9._/@+-]+$/;

function assertPath(value: string) {
  if (!PATH.test(value) || value.split("/").includes("..")) throw new Error(`Nieprawidłowa ścieżka: ${value}`);
}

export function buildInspectCommand(): string {
  return ["set +e", sectionCommand("docker-inspect", "all", 'ids="$(docker ps -aq)"; if [ -z "$ids" ]; then echo "[]"; else docker inspect $ids; fi')].join("\n");
}

export function buildStackProbeCommand(stacks: StackLocation[], imageIds: string[], ingress: { path: string | null; useSudo: boolean }): string {
  const parts = ["set +e"];

  for (const stack of stacks) {
    if (!IDENTIFIER.test(stack.project)) throw new Error(`Nieprawidłowa nazwa projektu Compose: ${stack.project}`);
    assertPath(stack.workingDir);
    stack.configFiles.forEach(assertPath);
    const directory = shellQuote(stack.workingDir);
    const files = stack.configFiles.map((file) => `-f ${shellQuote(file)}`).join(" ");

    parts.push(sectionCommand("compose-config", stack.project, `docker compose -p ${shellQuote(stack.project)} --project-directory ${directory} ${files} --profile '*' config --format json`));
    for (const file of stack.configFiles) parts.push(sectionCommand("compose-file", file, `cat ${shellQuote(file)}`));
    parts.push(sectionCommand("env-file", `${stack.workingDir}/.env`, `cat ${shellQuote(`${stack.workingDir}/.env`)}`));
    parts.push(sectionCommand("env-list", stack.project, `ls -1a ${directory} | grep -E '^\\.env'`));
    parts.push(sectionCommand("git", stack.project, `git -C ${directory} rev-parse HEAD && git -C ${directory} remote get-url origin`));
  }

  if (imageIds.some((imageId) => !IMAGE_ID.test(imageId))) throw new Error("Nieprawidłowy identyfikator obrazu.");
  if (imageIds.length) {
    parts.push(sectionCommand("image-env", "all", `docker image inspect ${imageIds.join(" ")} --format '{{json .Id}} {{json .Config.Env}}'`));
  }

  if (ingress.path) {
    assertPath(ingress.path);
    parts.push(sectionCommand("ingress", "config", `${ingress.useSudo ? "sudo -n " : ""}cat ${shellQuote(ingress.path)}`));
  }

  return parts.join("\n");
}

export function buildEnvFilesCommand(paths: string[]): string {
  paths.forEach(assertPath);
  return ["set +e", ...paths.map((path) => sectionCommand("env-file", path, `cat ${shellQuote(path)}`))].join("\n");
}

export function parseImageEnv(body: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const line of body.split("\n").filter(Boolean)) {
    const space = line.indexOf(" ");
    const imageId = JSON.parse(line.slice(0, space)) as string;
    const list = (JSON.parse(line.slice(space + 1)) as string[] | null) ?? [];
    result[imageId] = Object.fromEntries(list.map((item) => [item.slice(0, item.indexOf("=")), item.slice(item.indexOf("=") + 1)]));
  }
  return result;
}

export function parseGit(body: string, exitCode: number): GitFact | null {
  const [head, remote] = body.split("\n").map((line) => line.trim());
  if (!head || !/^[0-9a-f]{7,64}$/.test(head)) return null;
  // Manually cloned repositories can carry a token in the remote URL.
  const safeRemote = remote ? remote.replace(/^(https?:\/\/)[^/@]+@/i, "$1") : null;
  return { head, remote: exitCode === 0 && safeRemote ? safeRemote : null };
}
