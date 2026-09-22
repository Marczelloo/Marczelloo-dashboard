import "server-only";

import { createCloudflareClient, type CloudflareClient } from "./client";
import { dnsRecordsToRemove, planTunnelDns, tunnelTarget, zoneForHostname, type CloudflareZone } from "./dns";
import { isSafeHostname, localService, removeHostnameRoutes, sameIngress, upsertHostnameRoute, type TunnelIngressRule } from "./ingress";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT = /^[0-9a-f]{32}$/i;
const DNS_COMMENT = "Managed by Marczelloo Dashboard";

export interface ManagedTunnelSettings {
  accountId: string;
  tunnelId: string;
  legacyTunnelIds: string[];
}

interface Resolved extends ManagedTunnelSettings {
  client: CloudflareClient;
}

function resolve(): Resolved | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const tunnelId = process.env.CLOUDFLARE_TUNNEL_ID?.trim() ?? "";
  if (!apiToken || !ACCOUNT.test(accountId) || !UUID.test(tunnelId)) return null;
  const legacyTunnelIds = (process.env.CLOUDFLARE_LEGACY_TUNNEL_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => UUID.test(value) && value !== tunnelId);
  return { accountId, tunnelId, legacyTunnelIds, client: createCloudflareClient({ apiToken, accountId }) };
}

/** API mode replaces editing /etc/cloudflared/config.yml over SSH. */
export function getManagedTunnelSettings(): ManagedTunnelSettings | null {
  const resolved = resolve();
  return resolved ? { accountId: resolved.accountId, tunnelId: resolved.tunnelId, legacyTunnelIds: resolved.legacyTunnelIds } : null;
}

function requireResolved(): Resolved {
  const resolved = resolve();
  if (!resolved) throw new Error("The Cloudflare API is not configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_TUNNEL_ID).");
  return resolved;
}

// GET → modify → PUT of the whole configuration; updates from this process
// must not interleave or one of them would be lost.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

let zoneCache: { at: number; zones: CloudflareZone[] } | null = null;
export async function listManagedZones(): Promise<CloudflareZone[]> {
  const { client } = requireResolved();
  if (zoneCache && Date.now() - zoneCache.at < 5 * 60_000) return zoneCache.zones;
  const zones = (await client.listZones()).sort((a, b) => a.name.localeCompare(b.name));
  zoneCache = { at: Date.now(), zones };
  return zones;
}

export async function getManagedTunnelStatus(): Promise<{ tunnelId: string; name: string; status: string | null; zones: string[] }> {
  const { client, tunnelId } = requireResolved();
  const [tunnel, zones] = await Promise.all([client.getTunnel(tunnelId), listManagedZones()]);
  return { tunnelId, name: tunnel.name, status: tunnel.status ?? null, zones: zones.map((zone) => zone.name) };
}

export async function listManagedRoutes(): Promise<TunnelIngressRule[]> {
  const { client, tunnelId } = requireResolved();
  return (await client.getTunnelConfiguration(tunnelId)).config?.ingress ?? [];
}

export interface ManagedRouteUpdate {
  hostname: string | null;
  localPort: number | null;
  /** Origin to route to instead of the loopback port, e.g. http://marczelloo-tools:3000. */
  service?: string | null;
  removeHostnames?: string[];
}

const CONTAINER_ORIGIN = /^http:\/\/[A-Za-z0-9][A-Za-z0-9_.-]*:\d{1,5}$/;

export async function applyManagedRouteUpdate(update: ManagedRouteUpdate): Promise<{ changed: boolean; dns: string[] }> {
  const settings = requireResolved();
  const { client, tunnelId } = settings;
  const hostname = update.hostname?.trim().toLowerCase() || null;
  const removals = [...new Set((update.removeHostnames ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value && value !== hostname))];
  if (hostname && !isSafeHostname(hostname)) throw new Error("Invalid tunnel domain.");
  if (removals.some((value) => !isSafeHostname(value))) throw new Error("Invalid domain to remove from the tunnel.");
  if (update.service && !CONTAINER_ORIGIN.test(update.service)) throw new Error("Invalid tunnel route target.");
  const service = hostname ? update.service || localService(update.localPort ?? 0) : null;

  return serialized(async () => {
    const zones = await listManagedZones();
    const zoneOf = (host: string) => {
      const zone = zoneForHostname(zones, host);
      if (!zone) throw new Error(`${host} is not in any zone of this Cloudflare account.`);
      return zone;
    };

    // Plan DNS before touching the tunnel, so a foreign record aborts without side effects.
    const dnsPlan = hostname ? await (async () => {
      const zone = zoneOf(hostname);
      return { zone, action: planTunnelDns(hostname, await client.listDnsRecords(zone.id, hostname), tunnelId, settings.legacyTunnelIds) };
    })() : null;
    if (dnsPlan?.action.kind === "conflict") throw new Error(dnsPlan.action.message);

    const current = await client.getTunnelConfiguration(tunnelId);
    if (!current.config) throw new Error("The tunnel has no configuration in Cloudflare yet.");
    let ingress = current.config.ingress;
    if (removals.length) ingress = removeHostnameRoutes(ingress, removals);
    if (hostname && service) ingress = upsertHostnameRoute(ingress, hostname, service);
    const changed = !sameIngress(ingress, current.config.ingress);
    if (changed) await client.putTunnelConfiguration(tunnelId, { ...current.config, ingress });

    const dns: string[] = [];
    if (dnsPlan && hostname) {
      if (dnsPlan.action.kind === "create") {
        await client.createCname(dnsPlan.zone.id, hostname, tunnelTarget(tunnelId), DNS_COMMENT);
        dns.push(`utworzono CNAME ${hostname}`);
      } else if (dnsPlan.action.kind === "update") {
        await client.updateCname(dnsPlan.zone.id, dnsPlan.action.recordId, hostname, tunnelTarget(tunnelId), DNS_COMMENT);
        dns.push(`moved CNAME ${hostname}`);
      }
    }
    for (const host of removals) {
      const zone = zoneForHostname(zones, host);
      if (!zone) continue;
      for (const recordId of dnsRecordsToRemove(host, await client.listDnsRecords(zone.id, host), tunnelId)) {
        await client.deleteDnsRecord(zone.id, recordId);
        dns.push(`removed CNAME ${host}`);
      }
    }
    return { changed, dns };
  });
}
