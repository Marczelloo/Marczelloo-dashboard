// No "server-only" import: migration scripts run this client outside Next.js.
import { z } from "zod";
import type { CloudflareDnsRecord, CloudflareZone } from "./dns";
import type { TunnelConfiguration } from "./ingress";

const API = "https://api.cloudflare.com/client/v4";

export class CloudflareApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CloudflareApiError";
  }
}

const envelope = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ code: z.number().optional(), message: z.string() })).default([]),
  result: z.unknown(),
  result_info: z.object({ page: z.number(), total_pages: z.number() }).partial().optional(),
});

const zoneSchema = z.object({ id: z.string(), name: z.string() });
const recordSchema = z.object({ id: z.string(), type: z.string(), name: z.string(), content: z.string(), proxied: z.boolean().optional() });
const tunnelSchema = z.object({ id: z.string(), name: z.string(), status: z.string().optional(), config_src: z.string().optional() });
const ruleSchema = z
  .object({ hostname: z.string().optional(), path: z.string().optional(), service: z.string(), originRequest: z.record(z.unknown()).optional() })
  .passthrough();
const configurationSchema = z.object({
  version: z.number().optional(),
  config: z.object({ ingress: z.array(ruleSchema) }).passthrough().nullable(),
});

export interface CloudflareClientOptions {
  apiToken: string;
  accountId: string;
  fetchImpl?: typeof fetch;
}

export type CloudflareClient = ReturnType<typeof createCloudflareClient>;

export function createCloudflareClient({ apiToken, accountId, fetchImpl = fetch }: CloudflareClientOptions) {
  async function call(method: string, path: string, body?: unknown): Promise<z.infer<typeof envelope>> {
    const response = await fetchImpl(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const parsed = envelope.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new CloudflareApiError(`Cloudflare API: nieoczekiwana odpowiedź (${response.status}).`, response.status);
    if (!response.ok || !parsed.data.success) {
      const message = parsed.data.errors.map((error) => error.message).join("; ") || `HTTP ${response.status}`;
      throw new CloudflareApiError(`Cloudflare API: ${message}`, response.status);
    }
    return parsed.data;
  }

  const account = `/accounts/${encodeURIComponent(accountId)}`;
  const tunnelPath = (tunnelId: string) => `${account}/cfd_tunnel/${encodeURIComponent(tunnelId)}`;

  return {
    async getTunnel(tunnelId: string) {
      return tunnelSchema.parse((await call("GET", tunnelPath(tunnelId))).result);
    },
    async createTunnel(name: string) {
      return tunnelSchema.parse((await call("POST", `${account}/cfd_tunnel`, { name, config_src: "cloudflare" })).result);
    },
    async getTunnelToken(tunnelId: string): Promise<string> {
      return z.string().min(1).parse((await call("GET", `${tunnelPath(tunnelId)}/token`)).result);
    },
    async getTunnelConfiguration(tunnelId: string): Promise<{ version: number | null; config: TunnelConfiguration | null }> {
      const result = configurationSchema.parse((await call("GET", `${tunnelPath(tunnelId)}/configurations`)).result);
      return { version: result.version ?? null, config: result.config as TunnelConfiguration | null };
    },
    async putTunnelConfiguration(tunnelId: string, config: TunnelConfiguration): Promise<void> {
      await call("PUT", `${tunnelPath(tunnelId)}/configurations`, { config });
    },
    async listZones(): Promise<CloudflareZone[]> {
      const zones: CloudflareZone[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const data = await call("GET", `/zones?per_page=50&page=${page}&account.id=${encodeURIComponent(accountId)}`);
        zones.push(...z.array(zoneSchema).parse(data.result));
        if (!data.result_info?.total_pages || page >= data.result_info.total_pages) break;
      }
      return zones;
    },
    async listDnsRecords(zoneId: string, name: string): Promise<CloudflareDnsRecord[]> {
      const data = await call("GET", `/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=100&name=${encodeURIComponent(name)}`);
      return z.array(recordSchema).parse(data.result);
    },
    async createCname(zoneId: string, name: string, content: string, comment: string): Promise<CloudflareDnsRecord> {
      return recordSchema.parse((await call("POST", `/zones/${encodeURIComponent(zoneId)}/dns_records`, { type: "CNAME", name, content, proxied: true, ttl: 1, comment })).result);
    },
    async updateCname(zoneId: string, recordId: string, name: string, content: string, comment: string): Promise<CloudflareDnsRecord> {
      const path = `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`;
      return recordSchema.parse((await call("PATCH", path, { type: "CNAME", name, content, proxied: true, ttl: 1, comment })).result);
    },
    async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
      await call("DELETE", `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`);
    },
  };
}
