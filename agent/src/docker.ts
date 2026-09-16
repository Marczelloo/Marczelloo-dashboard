import { runCommand } from "./exec";
import { parseInspectSamples, parseServiceImages, type ContainerSample } from "./health";

const silent = () => undefined;

async function inspectProject(composeProject: string): Promise<string | null> {
  const ids = await runCommand(
    { label: "docker ps", command: "docker", args: ["ps", "-aq", "--filter", `label=com.docker.compose.project=${composeProject}`], timeoutMs: 30_000, quiet: true },
    silent
  );
  const list = ids.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  if (ids.code !== 0 || !list.length) return null;
  // docker inspect contains env values: never logged.
  const inspect = await runCommand({ label: "docker inspect", command: "docker", args: ["inspect", ...list], timeoutMs: 30_000, quiet: true }, silent);
  return inspect.code === 0 ? inspect.stdout : null;
}

export async function sampleContainers(composeProject: string): Promise<ContainerSample[]> {
  const json = await inspectProject(composeProject);
  return json ? parseInspectSamples(json) : [];
}

export async function serviceImages(composeProject: string): Promise<Record<string, string>> {
  const json = await inspectProject(composeProject);
  return json ? parseServiceImages(json) : {};
}

export async function probe(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    return response.status;
  } catch {
    return null;
  }
}
