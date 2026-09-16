export interface CloudflareZone {
  id: string;
  name: string;
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
}

export type TunnelDnsAction =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "update"; recordId: string }
  | { kind: "conflict"; message: string };

export function tunnelTarget(tunnelId: string): string {
  return `${tunnelId}.cfargotunnel.com`;
}

/** The most specific zone that contains the hostname (sub.example.co.uk before example.co.uk). */
export function zoneForHostname(zones: CloudflareZone[], hostname: string): CloudflareZone | null {
  const host = hostname.toLowerCase();
  return (
    zones
      .filter((zone) => host === zone.name.toLowerCase() || host.endsWith(`.${zone.name.toLowerCase()}`))
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null
  );
}

/**
 * Decide how to point a hostname at the tunnel. Records that point at an
 * older tunnel of this Pi are moved; anything else (Vercel, mail, A records)
 * is someone else's and is never overwritten.
 */
export function planTunnelDns(hostname: string, records: CloudflareDnsRecord[], tunnelId: string, legacyTunnelIds: string[]): TunnelDnsAction {
  const host = hostname.toLowerCase();
  const own = records.filter((record) => record.name.toLowerCase() === host);
  if (!own.length) return { kind: "create" };

  const cname = own.find((record) => record.type === "CNAME");
  if (!cname || own.length > 1) {
    return { kind: "conflict", message: `${host} ma już rekordy ${own.map((record) => record.type).join(", ")} — dashboard ich nie nadpisze.` };
  }
  const content = cname.content.toLowerCase();
  if (content === tunnelTarget(tunnelId)) return cname.proxied ? { kind: "none" } : { kind: "update", recordId: cname.id };
  if (legacyTunnelIds.some((id) => content === tunnelTarget(id))) return { kind: "update", recordId: cname.id };
  return { kind: "conflict", message: `${host} wskazuje na ${cname.content} — dashboard nie nadpisze obcego rekordu.` };
}

/** Only CNAMEs pointing at this tunnel are removed together with a route. */
export function dnsRecordsToRemove(hostname: string, records: CloudflareDnsRecord[], tunnelId: string): string[] {
  const host = hostname.toLowerCase();
  return records
    .filter((record) => record.name.toLowerCase() === host && record.type === "CNAME" && record.content.toLowerCase() === tunnelTarget(tunnelId))
    .map((record) => record.id);
}
