"use server";

import { isDemoMode } from "@/lib/demo-mode";
import { getManagedTunnelSettings, listManagedZones } from "@/server/cloudflare/managed-tunnel";
import { requireAuth } from "@/server/lib/auth";

/** Zones the tunnel can publish hostnames in; an empty list means free-text hostnames (file mode). */
export async function listCloudflareZonesAction(): Promise<{ success: boolean; zones: string[]; error?: string }> {
  try {
    if (isDemoMode()) return { success: true, zones: ["example.dev"] };
    await requireAuth();
    if (!getManagedTunnelSettings()) return { success: true, zones: [] };
    return { success: true, zones: (await listManagedZones()).map((zone) => zone.name) };
  } catch (error) {
    return { success: false, zones: [], error: error instanceof Error ? error.message : "Could not load the domains from Cloudflare." };
  }
}
