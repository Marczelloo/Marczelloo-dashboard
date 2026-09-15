import path from "node:path";
import { parse } from "yaml";

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
