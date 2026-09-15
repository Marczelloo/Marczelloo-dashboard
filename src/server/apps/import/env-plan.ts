import type { EnvEntry } from "@/server/env/dotenv";
import type { ComposeConfig, ContainerFact } from "../types";

export type EnvOrigin = "file" | "compose" | "container" | "legacy-db";
export type EnvConflict = "file-differs" | "services-differ" | "legacy-differs" | "not-in-container";

export interface EnvPlanEntry {
  key: string;
  value: string;
  perService: Record<string, string> | null;
  origin: EnvOrigin;
  sourcePath: string | null;
  services: string[];
  secret: boolean;
  include: boolean;
  conflicts: EnvConflict[];
}

export interface EnvPlanInput {
  containers: ContainerFact[];
  imageEnv: Record<string, Record<string, string>>;
  composeConfig: ComposeConfig | null;
  envFiles: Array<{ path: string; entries: EnvEntry[]; interpolation: boolean }>;
  legacy: Array<{ key: string; value: string }>;
}

const SECRET = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|MASTER_?KEY|DSN|WEBHOOK|COOKIE|_PASS$)/i;

export function isSecretKey(key: string): boolean {
  return SECRET.test(key);
}

export function buildEnvPlan(input: EnvPlanInput): EnvPlanEntry[] {
  const perKey = new Map<string, Record<string, string>>();
  for (const container of input.containers) {
    const service = container.composeService ?? container.name;
    const imageDefaults = input.imageEnv[container.imageId] ?? {};
    for (const [key, value] of Object.entries(container.env)) {
      if (imageDefaults[key] === value) continue;
      perKey.set(key, { ...(perKey.get(key) ?? {}), [service]: value });
    }
  }

  const legacy = new Map<string, Set<string>>();
  for (const entry of input.legacy) legacy.set(entry.key, new Set([...(legacy.get(entry.key) ?? []), entry.value]));

  const findInFiles = (key: string) => {
    for (const file of input.envFiles) {
      const entry = file.entries.find((candidate) => candidate.key === key);
      if (entry) return { path: file.path, value: entry.value, interpolation: file.interpolation };
    }
    return null;
  };
  const composeValue = (key: string) =>
    Object.values(input.composeConfig?.services ?? {})
      .map((service) => service.environment?.[key])
      .find((value): value is string => typeof value === "string");

  const entries: EnvPlanEntry[] = [];

  for (const [key, perService] of perKey) {
    const values = [...new Set(Object.values(perService))];
    const file = findInFiles(key);
    const fromCompose = composeValue(key);
    const conflicts: EnvConflict[] = [];
    if (values.length > 1) conflicts.push("services-differ");
    if (file && !values.includes(file.value)) conflicts.push("file-differs");
    const legacyValues = legacy.get(key);
    if (legacyValues && !values.some((value) => legacyValues.has(value))) conflicts.push("legacy-differs");

    const origin: EnvOrigin = file && values.includes(file.value) ? "file" : fromCompose !== undefined && values.includes(fromCompose) ? "compose" : "container";

    entries.push({
      key,
      value: Object.values(perService)[0],
      perService: values.length > 1 ? perService : null,
      origin,
      sourcePath: origin === "file" ? file!.path : null,
      services: Object.keys(perService).sort(),
      secret: isSecretKey(key),
      include: true,
      conflicts,
    });
  }

  for (const file of input.envFiles) {
    for (const entry of file.entries) {
      if (perKey.has(entry.key) || entries.some((candidate) => candidate.key === entry.key)) continue;
      entries.push({ key: entry.key, value: entry.value, perService: null, origin: "file", sourcePath: file.path, services: [], secret: isSecretKey(entry.key), include: file.interpolation, conflicts: ["not-in-container"] });
    }
  }

  for (const [key, values] of legacy) {
    if (entries.some((candidate) => candidate.key === key)) continue;
    entries.push({ key, value: [...values][0], perService: null, origin: "legacy-db", sourcePath: null, services: [], secret: isSecretKey(key), include: false, conflicts: ["not-in-container"] });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}
