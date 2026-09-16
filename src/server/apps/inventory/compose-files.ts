import path from "node:path";
import { parse } from "yaml";
import type { ComposeConfig } from "../types";

const unescapeDollars = (value: string) => value.replace(/\$\$/g, "$");

/**
 * `docker compose config --format json` escapes every literal "$" as "$$".
 * Environment values and labels are compared with running containers, so
 * they are converted back to the effective values.
 */
export function normalizeComposeConfig(config: ComposeConfig): ComposeConfig {
  const services = Object.fromEntries(
    Object.entries(config.services ?? {}).map(([name, service]) => {
      const next = { ...service };
      if (service.environment) {
        next.environment = Object.fromEntries(Object.entries(service.environment).map(([key, value]) => [key, typeof value === "string" ? unescapeDollars(value) : value]));
      }
      if (service.labels) {
        next.labels = Object.fromEntries(Object.entries(service.labels).map(([key, value]) => [key, unescapeDollars(value)]));
      }
      return [name, next];
    })
  );
  return { ...config, services };
}

export function extractEnvFileRefs(rawYaml: string, composeFilePath: string): string[] {
  const document = parse(rawYaml) as { services?: Record<string, { env_file?: unknown } | null> } | null;
  const directory = path.posix.dirname(composeFilePath);
  const refs = new Set<string>();

  for (const service of Object.values(document?.services ?? {})) {
    const envFile = service?.env_file;
    const entries = Array.isArray(envFile) ? envFile : envFile === undefined ? [] : [envFile];
    for (const entry of entries) {
      const value =
        typeof entry === "string"
          ? entry
          : entry && typeof entry === "object" && typeof (entry as { path?: unknown }).path === "string"
            ? (entry as { path: string }).path
            : null;
      if (!value || value.includes("${")) continue;
      refs.add(path.posix.normalize(path.posix.isAbsolute(value) ? value : path.posix.join(directory, value)));
    }
  }

  return [...refs].sort();
}
