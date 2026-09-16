import "server-only";

import { getManagedTunnelSettings, listManagedRoutes } from "@/server/cloudflare/managed-tunnel";
import { getCloudflareTunnelSettings, runHostCommand } from "@/server/deployments";
import { buildEnvFilesCommand, buildInspectCommand, buildStackProbeCommand, IMAGE_ID, parseGit, parseImageEnv, type StackLocation } from "./inventory/commands";
import { extractEnvFileRefs, normalizeComposeConfig } from "./inventory/compose-files";
import { groupByComposeProject, parseDockerInspect } from "./inventory/docker-facts";
import { parseIngressConfig } from "./inventory/ingress";
import { parseSections, type Section } from "./inventory/sections";
import type { ComposeConfig, EnvFileSnapshot, InventorySnapshot, StackSnapshot } from "./types";

function find(sections: Section[], kind: string, id: string) {
  return sections.find((section) => section.kind === kind && section.id === id);
}

export async function collectInventory(): Promise<InventorySnapshot> {
  const capturedAt = new Date().toISOString();
  const inspectResult = await runHostCommand(buildInspectCommand(), 30_000);
  const inspect = find(parseSections(inspectResult.stdout), "docker-inspect", "all");
  if (!inspect || inspect.exitCode !== 0) throw new Error("Nie udało się odczytać kontenerów Dockera przez runner.");

  const containers = parseDockerInspect(inspect.body);
  const { stacks, loose } = groupByComposeProject(containers);
  const locations: StackLocation[] = [...stacks].flatMap(([project, list]) => {
    const reference = list.find((container) => !container.oneOff && container.workingDir) ?? list.find((container) => container.workingDir);
    return reference?.workingDir ? [{ project, workingDir: reference.workingDir, configFiles: reference.configFiles }] : [];
  });

  const managedTunnel = getManagedTunnelSettings();
  const tunnel = await getCloudflareTunnelSettings();
  const imageIds = [...new Set(containers.map((container) => container.imageId).filter((imageId) => IMAGE_ID.test(imageId)))];
  const probe = parseSections((await runHostCommand(buildStackProbeCommand(locations, imageIds, { path: managedTunnel ? null : tunnel.configPath, useSudo: tunnel.useSudo }), 120_000)).stdout);

  const referencedEnv = new Map<string, string[]>();
  for (const location of locations) {
    const refs = location.configFiles.flatMap((file) => {
      const section = find(probe, "compose-file", file);
      return section && section.exitCode === 0 ? extractEnvFileRefs(section.body, file) : [];
    });
    referencedEnv.set(location.project, refs.filter((ref) => ref !== `${location.workingDir}/.env`));
  }
  const extraPaths = [...new Set([...referencedEnv.values()].flat())];
  const extra = extraPaths.length ? parseSections((await runHostCommand(buildEnvFilesCommand(extraPaths), 30_000)).stdout) : [];

  const envSnapshot = (path: string, sections: Section[]): EnvFileSnapshot => {
    const section = find(sections, "env-file", path);
    return { path, content: section && section.exitCode === 0 ? section.body : null };
  };

  const stackSnapshots: StackSnapshot[] = [...stacks].map(([project, list]) => {
    const location = locations.find((candidate) => candidate.project === project);
    if (!location) {
      return { project, workingDir: null, configFiles: [], containers: list, composeConfig: null, composeConfigError: "Kontenery nie mają etykiety katalogu Compose.", envFiles: [], otherEnvFiles: [], git: null };
    }
    const config = find(probe, "compose-config", project);
    let composeConfig: ComposeConfig | null = null;
    let composeConfigError: string | null = null;
    if (config && config.exitCode === 0) {
      try {
        composeConfig = normalizeComposeConfig(JSON.parse(config.body) as ComposeConfig);
      } catch {
        composeConfigError = "Niepoprawny JSON z docker compose config.";
      }
    } else {
      composeConfigError = `docker compose config zakończył się kodem ${config?.exitCode ?? "brak"}.`;
    }

    const envFiles = [envSnapshot(`${location.workingDir}/.env`, probe), ...(referencedEnv.get(project) ?? []).map((path) => envSnapshot(path, extra))];
    const readNames = new Set(envFiles.map((file) => file.path.split("/").pop()));
    const listed = find(probe, "env-list", project);
    const otherEnvFiles = (listed?.body ?? "").split("\n").map((name) => name.trim()).filter((name) => name && !readNames.has(name));
    const git = find(probe, "git", project);

    return { project, workingDir: location.workingDir, configFiles: location.configFiles, containers: list, composeConfig, composeConfigError, envFiles, otherEnvFiles, git: git ? parseGit(git.body, git.exitCode) : null };
  });

  const imageSection = find(probe, "image-env", "all");
  const ingressSection = find(probe, "ingress", "config");
  let ingress: InventorySnapshot["ingress"] = { rules: [], error: tunnel.configPath ? "Nie odczytano konfiguracji cloudflared." : "Ścieżka konfiguracji tunelu nie jest ustawiona." };
  if (managedTunnel) {
    try {
      const rules = await listManagedRoutes();
      ingress = {
        rules: rules.map((rule, position) => ({
          position,
          hostname: rule.hostname?.toLowerCase() ?? null,
          path: rule.path ?? null,
          service: rule.service,
          originRequest: rule.originRequest && Object.keys(rule.originRequest).length ? rule.originRequest : null,
        })),
        error: null,
      };
    } catch (error) {
      ingress = { rules: [], error: error instanceof Error ? error.message : "Nie odczytano tras z Cloudflare API." };
    }
  } else if (ingressSection && ingressSection.exitCode === 0) {
    try {
      ingress = { rules: parseIngressConfig(ingressSection.body), error: null };
    } catch (error) {
      ingress = { rules: [], error: error instanceof Error ? error.message : "Błąd parsowania konfiguracji cloudflared." };
    }
  }

  return {
    capturedAt,
    stacks: stackSnapshots.sort((a, b) => a.project.localeCompare(b.project)),
    looseContainers: loose,
    imageEnv: imageSection && imageSection.exitCode === 0 ? parseImageEnv(imageSection.body) : {},
    ingress,
  };
}
