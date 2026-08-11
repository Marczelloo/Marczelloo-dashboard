import "server-only";

import { settings } from "@/server/atlashub";

export type DeploymentRuntime = "web" | "worker" | "bot" | "stack";
export type DeploymentExposure = "internal" | "cloudflare";

export interface CloudflareTunnelRoute {
  enabled: boolean;
  hostname: string;
  localPort: number;
}

/**
 * The deploy configuration is deliberately separate from the legacy service
 * rows. Services describe observed containers; this describes how a project
 * is provisioned. It is stored in the existing settings key-value store so
 * the dashboard can be upgraded without an AtlasHub schema migration.
 */
export interface DeploymentConfig {
  version: 1;
  projectId: string;
  githubUrl: string;
  branch: string;
  repoPath: string;
  composeFile: string | null;
  composeProject: string;
  profiles: string[];
  runtime: DeploymentRuntime;
  exposure: DeploymentExposure;
  tunnel: CloudflareTunnelRoute | null;
  createdAt: string;
  updatedAt: string;
}

const KEY_PREFIX = "deployment-config:";

function settingKey(projectId: string) {
  return `${KEY_PREFIX}${projectId}`;
}

function isDeploymentConfig(value: unknown): value is DeploymentConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<DeploymentConfig>;
  return (
    config.version === 1 &&
    typeof config.projectId === "string" &&
    typeof config.githubUrl === "string" &&
    typeof config.branch === "string" &&
    typeof config.repoPath === "string" &&
    typeof config.composeProject === "string" &&
    Array.isArray(config.profiles) &&
    ["web", "worker", "bot", "stack"].includes(config.runtime || "") &&
    ["internal", "cloudflare"].includes(config.exposure || "")
  );
}

export async function getDeploymentConfig(projectId: string): Promise<DeploymentConfig | null> {
  const value = await settings.getSetting(settingKey(projectId));
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isDeploymentConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveDeploymentConfig(
  input: Omit<DeploymentConfig, "version" | "createdAt" | "updatedAt">
): Promise<DeploymentConfig> {
  const existing = await getDeploymentConfig(input.projectId);
  const now = new Date().toISOString();
  const config: DeploymentConfig = {
    ...input,
    version: 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const saved = await settings.setSetting(settingKey(input.projectId), JSON.stringify(config));
  if (!saved) {
    throw new Error('Nie udało się zapisać konfiguracji wdrożenia. Tabela "settings" musi być dostępna.');
  }

  return config;
}

export async function deleteDeploymentConfig(projectId: string): Promise<void> {
  await settings.deleteSetting(settingKey(projectId));
}
