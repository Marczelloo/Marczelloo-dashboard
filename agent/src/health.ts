export interface ContainerSample {
  name: string;
  service: string;
  status: string;
  exitCode: number;
  restartCount: number;
  health: string | null;
}

export type GateState = { state: "pass" } | { state: "wait"; reason: string } | { state: "fail"; reason: string };

interface RawInspect {
  Name: string;
  RestartCount?: number;
  State?: { Status?: string; ExitCode?: number; Health?: { Status?: string } | null } | null;
  Config?: { Labels?: Record<string, string> | null } | null;
}

export function parseInspectSamples(json: string): ContainerSample[] {
  return (JSON.parse(json) as RawInspect[])
    .filter((item) => item.Config?.Labels?.["com.docker.compose.oneoff"] !== "True")
    .map((item) => ({
      name: item.Name.replace(/^\//, ""),
      service: item.Config?.Labels?.["com.docker.compose.service"] ?? "",
      status: item.State?.Status ?? "unknown",
      exitCode: item.State?.ExitCode ?? 0,
      restartCount: item.RestartCount ?? 0,
      health: item.State?.Health?.Status ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Compose service → image ID of its running container (one-off containers ignored). */
export function parseServiceImages(json: string): Record<string, string> {
  const images: Record<string, string> = {};
  for (const item of JSON.parse(json) as Array<RawInspect & { Image?: string }>) {
    const labels = item.Config?.Labels ?? {};
    const service = labels["com.docker.compose.service"];
    if (!service || labels["com.docker.compose.oneoff"] === "True" || !item.Image) continue;
    if (item.State?.Status !== "running" && item.State?.Status !== "restarting") continue;
    images[service] = item.Image;
  }
  return images;
}

export function assessContainers(samples: ContainerSample[][], elapsedMs: number, options: { stableMs: number; timeoutMs: number }): GateState {
  const latest = samples.at(-1) ?? [];
  if (!latest.length) return { state: "fail", reason: "Projekt nie ma żadnych kontenerów po uruchomieniu." };

  const baseline = new Map<string, number>();
  for (const round of samples) for (const container of round) if (!baseline.has(container.name)) baseline.set(container.name, container.restartCount);

  for (const container of latest) {
    if (container.status === "exited" && container.exitCode !== 0) {
      return { state: "fail", reason: `Kontener ${container.name} zakończył działanie z kodem ${container.exitCode}.` };
    }
    if (container.status === "dead" || container.status === "restarting") {
      return { state: "fail", reason: `Kontener ${container.name} jest w stanie ${container.status}.` };
    }
    if (container.restartCount > (baseline.get(container.name) ?? container.restartCount)) {
      return { state: "fail", reason: `Kontener ${container.name} restartuje się.` };
    }
    if (container.health === "unhealthy") {
      return { state: "fail", reason: `Kontener ${container.name} zgłasza stan unhealthy.` };
    }
  }

  if (elapsedMs < options.stableMs) return { state: "wait", reason: "Obserwacja stabilności kontenerów." };

  const notReady = latest.filter((container) => container.health === "starting" || container.status === "created").map((container) => container.name);
  if (notReady.length) {
    return elapsedMs >= options.timeoutMs
      ? { state: "fail", reason: `Kontenery nie osiągnęły gotowości: ${notReady.join(", ")}.` }
      : { state: "wait", reason: `Czekam na healthcheck: ${notReady.join(", ")}.` };
  }
  return { state: "pass" };
}

export function assessProbe(status: number | null): "pass" | "retry" {
  if (status === null) return "retry";
  // 5xx: the application failed or (502/503/504, Cloudflare 52x) the origin did not answer.
  return status >= 500 ? "retry" : "pass";
}
