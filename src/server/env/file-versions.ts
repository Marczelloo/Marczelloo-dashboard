import { createHash } from "node:crypto";
import { isSecretKey } from "@/server/apps/import/env-plan";
import { parseEnvEntries } from "./dotenv";

/** A whole env file as the editor saved it; version 1 payloads come from the stage 1 import. */
export interface EnvFileVersionPayload {
  version: 2;
  fileName: string;
  content: string;
}

/** Stored in the plain `keys` column: names only, never values. Import versions store an array instead. */
export interface EnvFileVersionKeys {
  file: string;
  keys: Array<{ key: string; secret: boolean }>;
}

export function envFilePayload(fileName: string, content: string): EnvFileVersionPayload {
  return { version: 2, fileName, content };
}

export function envFileFingerprint(fileName: string, content: string): string {
  return createHash("sha256").update(`${fileName}\0${content}`).digest("hex");
}

export function envFileKeys(fileName: string, content: string): EnvFileVersionKeys {
  return { file: fileName, keys: parseEnvEntries(content).map((entry) => ({ key: entry.key, secret: isSecretKey(entry.key) })) };
}

export interface EnvVersionMeta {
  version: number;
  fingerprint: string;
  keys: unknown;
}

/** The file an editor version belongs to; import versions (keys without `file`) return null. */
export function versionFile(meta: Pick<EnvVersionMeta, "keys">): string | null {
  const keys = meta.keys as Partial<EnvFileVersionKeys> | null;
  return keys && !Array.isArray(keys) && typeof keys.file === "string" ? keys.file : null;
}

export function versionKeyCount(meta: Pick<EnvVersionMeta, "keys">): number {
  const keys = meta.keys as Partial<EnvFileVersionKeys> | unknown[] | null;
  if (Array.isArray(keys)) return keys.length;
  return Array.isArray(keys?.keys) ? keys.keys.length : 0;
}

/** Newest version of one file, given versions sorted newest first. */
export function latestVersionOfFile<T extends EnvVersionMeta>(versions: T[], fileName: string): T | null {
  return versions.find((meta) => versionFile(meta) === fileName) ?? null;
}

export function nextVersionNumber(versions: EnvVersionMeta[]): number {
  return versions.reduce((max, meta) => Math.max(max, meta.version), 0) + 1;
}
