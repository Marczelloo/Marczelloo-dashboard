import "server-only";

import { settings } from "@/server/atlashub";

const SETTINGS_KEY = "cloudflare-tunnel-config";

export interface CloudflareTunnelSettings {
  configPath: string | null;
  useSudo: boolean;
  tunnelName: string;
  source: "database" | "environment" | "none";
}

export interface CloudflareTunnelSettingsInput {
  configPath: string;
  useSudo: boolean;
  tunnelName?: string;
}

function isSafeAbsolutePath(value: string): boolean {
  return /^\/[A-Za-z0-9._/-]+$/.test(value) && !value.includes("..") && value.length <= 240;
}

function isSafeTunnelName(value: string): boolean {
  return !value || /^[A-Za-z0-9][A-Za-z0-9_.-]{0,126}$/.test(value);
}

function environmentSettings(): CloudflareTunnelSettings {
  const configPath = process.env.CLOUDFLARED_CONFIG_PATH || null;
  return {
    configPath: configPath && isSafeAbsolutePath(configPath) ? configPath : null,
    useSudo: process.env.CLOUDFLARED_CONFIG_USE_SUDO === "true",
    tunnelName: process.env.CLOUDFLARED_TUNNEL_NAME || "",
    source: configPath ? "environment" : "none",
  };
}

function parseStoredSettings(value: string): CloudflareTunnelSettings | null {
  try {
    const parsed = JSON.parse(value) as Partial<CloudflareTunnelSettingsInput>;
    if (typeof parsed.configPath !== "string" || !isSafeAbsolutePath(parsed.configPath)) return null;
    if (typeof parsed.useSudo !== "boolean") return null;
    const tunnelName = typeof parsed.tunnelName === "string" ? parsed.tunnelName.trim() : "";
    if (!isSafeTunnelName(tunnelName)) return null;
    return { configPath: parsed.configPath, useSudo: parsed.useSudo, tunnelName, source: "database" };
  } catch {
    return null;
  }
}

export async function getCloudflareTunnelSettings(): Promise<CloudflareTunnelSettings> {
  const stored = await settings.getSetting(SETTINGS_KEY);
  return stored ? parseStoredSettings(stored) || environmentSettings() : environmentSettings();
}

export async function saveCloudflareTunnelSettings(input: CloudflareTunnelSettingsInput): Promise<CloudflareTunnelSettings> {
  const configPath = input.configPath.trim();
  const tunnelName = input.tunnelName?.trim() || "";
  if (!isSafeAbsolutePath(configPath)) throw new Error("Ścieżka konfiguracji Tunnel musi być bezpieczną ścieżką absolutną.");
  if (!isSafeTunnelName(tunnelName)) throw new Error("Nazwa Tunnel zawiera niedozwolone znaki.");

  const saved = await settings.setSetting(SETTINGS_KEY, JSON.stringify({ configPath, useSudo: input.useSudo, tunnelName }));
  if (!saved) throw new Error("Nie udało się zapisać ustawień Cloudflare Tunnel.");
  return { configPath, useSudo: input.useSudo, tunnelName, source: "database" };
}

export function getCloudflareReloadCommand(settings: CloudflareTunnelSettings): string {
  return process.env.CLOUDFLARED_RELOAD_COMMAND || (settings.useSudo ? "sudo -n systemctl restart cloudflared" : "systemctl restart cloudflared");
}
