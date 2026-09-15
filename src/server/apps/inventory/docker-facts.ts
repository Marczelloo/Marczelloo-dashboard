import type { ContainerFact, PortBinding } from "../types";

interface RawInspect {
  Id: string;
  Name: string;
  Created: string;
  Image: string;
  State?: { Status?: string } | null;
  Config?: { Image?: string; Env?: string[] | null; Labels?: Record<string, string> | null } | null;
  NetworkSettings?: {
    Ports?: Record<string, Array<{ HostIp: string; HostPort: string }> | null> | null;
    Networks?: Record<string, unknown> | null;
  } | null;
  Mounts?: Array<{ Type: string; Name?: string; Source: string; Destination: string; RW: boolean }> | null;
}

function parseEnvList(list: string[] | null | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  for (const item of list ?? []) {
    const index = item.indexOf("=");
    if (index > 0) env[item.slice(0, index)] = item.slice(index + 1);
  }
  return env;
}

export function parseDockerInspect(json: string): ContainerFact[] {
  const raw = JSON.parse(json) as RawInspect[];
  return raw.map((item) => {
    const labels = item.Config?.Labels ?? {};
    const ports: PortBinding[] = [];
    for (const [key, bindings] of Object.entries(item.NetworkSettings?.Ports ?? {})) {
      const [containerPort, protocol = "tcp"] = key.split("/");
      for (const binding of bindings ?? []) {
        ports.push({ hostIp: binding.HostIp || "0.0.0.0", hostPort: Number(binding.HostPort), containerPort: Number(containerPort), protocol });
      }
    }
    ports.sort((a, b) => a.hostPort - b.hostPort || a.hostIp.localeCompare(b.hostIp));

    return {
      id: item.Id,
      name: item.Name.replace(/^\//, ""),
      image: item.Config?.Image ?? "",
      imageId: item.Image,
      status: item.State?.Status ?? "unknown",
      createdAt: item.Created,
      composeProject: labels["com.docker.compose.project"] ?? null,
      composeService: labels["com.docker.compose.service"] ?? null,
      oneOff: labels["com.docker.compose.oneoff"] === "True",
      workingDir: labels["com.docker.compose.project.working_dir"] ?? null,
      configFiles: (labels["com.docker.compose.project.config_files"] ?? "").split(",").filter(Boolean),
      env: parseEnvList(item.Config?.Env),
      labels,
      ports,
      mounts: (item.Mounts ?? []).map((mount) => ({
        type: mount.Type,
        name: mount.Name ?? null,
        source: mount.Source,
        destination: mount.Destination,
        readOnly: !mount.RW,
      })),
      networks: Object.keys(item.NetworkSettings?.Networks ?? {}).sort(),
    };
  });
}

export function groupByComposeProject(containers: ContainerFact[]): { stacks: Map<string, ContainerFact[]>; loose: ContainerFact[] } {
  const stacks = new Map<string, ContainerFact[]>();
  const loose: ContainerFact[] = [];
  for (const container of containers) {
    if (!container.composeProject) {
      loose.push(container);
      continue;
    }
    stacks.set(container.composeProject, [...(stacks.get(container.composeProject) ?? []), container]);
  }
  return { stacks, loose };
}
