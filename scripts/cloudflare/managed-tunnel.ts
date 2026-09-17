/**
 * Stage 3 migration helper: from the locally managed tunnel to a tunnel whose
 * routes live in Cloudflare. Nothing here prints the API token or the tunnel token.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx tsx scripts/cloudflare/managed-tunnel.ts <command>
 *
 *   create <name> <legacyTunnelId>          new tunnel, ingress copied from the legacy tunnel
 *   token <tunnelId> <file>                 write TUNNEL_TOKEN=… to <file> (mode 600)
 *   compare <legacyTunnelId> <tunnelId>     ingress of both tunnels side by side
 *   switch-dns <fromTunnelId> <toTunnelId> [--apply] [hostname…]
 *                                           move proxied CNAMEs; dry run without --apply
 *   edge <tunnelId> <bindings.json> [--extra 8080=http://mz-static:8080] [--backup file] [--apply]
 *                                           route loopback origins to containers by name; dry run without --apply
 *   restore <tunnelId> <backup.json>        put a configuration saved by `edge --backup` back
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createCloudflareClient } from "../../src/server/cloudflare/client";
import { tunnelTarget } from "../../src/server/cloudflare/dns";
import { assertCatchAll, sameIngress, type TunnelConfiguration } from "../../src/server/cloudflare/ingress";
import { translateIngress, type PortBinding } from "../../src/server/deployments/edge";

export {};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function uuid(value: string | undefined, label: string): string {
  if (!value || !UUID.test(value)) throw new Error(`${label} must be a tunnel UUID`);
  return value;
}

const client = createCloudflareClient({ apiToken: required("CLOUDFLARE_API_TOKEN"), accountId: required("CLOUDFLARE_ACCOUNT_ID") });

/** Keep ingress and origin settings; drop connector flags that the legacy cloudflared reported. */
function portableConfig(config: TunnelConfiguration): TunnelConfiguration {
  assertCatchAll(config.ingress);
  const { ingress, originRequest, "warp-routing": warpRouting } = config;
  return { ingress, ...(originRequest ? { originRequest } : {}), ...(warpRouting ? { "warp-routing": warpRouting } : {}) };
}

async function create(name: string, legacyId: string) {
  const legacy = await client.getTunnelConfiguration(legacyId);
  if (!legacy.config) throw new Error("Legacy tunnel has no reported configuration");
  const tunnel = await client.createTunnel(name);
  await client.putTunnelConfiguration(tunnel.id, portableConfig(legacy.config));
  console.log(`created ${tunnel.name} ${tunnel.id} with ${legacy.config.ingress.length} ingress rules`);
}

async function compare(legacyId: string, tunnelId: string) {
  const [legacy, managed] = await Promise.all([client.getTunnelConfiguration(legacyId), client.getTunnelConfiguration(tunnelId)]);
  const a = legacy.config?.ingress ?? [];
  const b = managed.config?.ingress ?? [];
  const rows = Math.max(a.length, b.length);
  for (let index = 0; index < rows; index += 1) {
    const left = a[index] ? `${a[index].hostname ?? "*"}${a[index].path ?? ""} → ${a[index].service}` : "—";
    const right = b[index] ? `${b[index].hostname ?? "*"}${b[index].path ?? ""} → ${b[index].service}` : "—";
    console.log(`${left === right ? "  " : "≠ "}${left}   |   ${right}`);
  }
  console.log(sameIngress(a, b) ? "INGRESS_EQUAL" : "INGRESS_DIFFERENT");
}

async function switchDns(fromId: string, toId: string, apply: boolean, only: string[]) {
  const wanted = new Set(only.map((host) => host.toLowerCase()));
  const zones = await client.listZones();
  let matched = 0;
  for (const zone of zones) {
    for (const record of await listCnames(zone.id)) {
      if (record.type !== "CNAME" || record.content.toLowerCase() !== tunnelTarget(fromId)) continue;
      if (wanted.size && !wanted.has(record.name.toLowerCase())) continue;
      matched += 1;
      if (apply) await client.updateCname(zone.id, record.id, record.name, tunnelTarget(toId), "Zarządzane przez Marczelloo Dashboard");
      console.log(`${apply ? "switched" : "would switch"} ${record.name}`);
    }
  }
  console.log(`${matched} record(s) ${apply ? "switched" : "matched (dry run)"}`);
}

function optionValues(args: string[], name: string): string[] {
  return args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]] : []));
}

/** bindings.json is the publishedPorts array of the agent's GET /host. */
async function edge(tunnelId: string, bindingsFile: string, args: string[]) {
  const bindings = JSON.parse(readFileSync(bindingsFile, "utf8")) as PortBinding[];
  const extra = Object.fromEntries(
    optionValues(args, "--extra").map((entry) => {
      const [port, origin] = entry.split("=", 2);
      if (!/^\d+$/.test(port) || !/^http:\/\/[A-Za-z0-9][A-Za-z0-9_.-]*:\d+$/.test(origin ?? "")) throw new Error(`Invalid --extra ${entry}`);
      return [Number(port), origin];
    })
  );
  const current = await client.getTunnelConfiguration(tunnelId);
  if (!current.config) throw new Error("Tunnel has no configuration");
  const result = translateIngress(current.config.ingress, bindings, extra);
  for (const change of result.changes) console.log(`${change.hostname ?? "*"}: ${change.from} → ${change.to}`);
  for (const miss of result.unresolved) console.log(`UNRESOLVED ${miss.hostname ?? "*"}: ${miss.from}`);
  if (!args.includes("--apply")) return console.log(`${result.changes.length} change(s), ${result.unresolved.length} unresolved (dry run)`);
  if (result.unresolved.length) throw new Error("Refusing to apply with unresolved loopback routes");
  const [backup] = optionValues(args, "--backup");
  if (!backup) throw new Error("--apply requires --backup <file>");
  writeFileSync(backup, JSON.stringify(current.config, null, 2), { mode: 0o600 });
  await client.putTunnelConfiguration(tunnelId, { ...current.config, ingress: result.rules });
  console.log(`applied ${result.changes.length} change(s); previous configuration saved to ${backup}`);
}

async function restore(tunnelId: string, backupFile: string) {
  const config = JSON.parse(readFileSync(backupFile, "utf8")) as TunnelConfiguration;
  assertCatchAll(config.ingress);
  await client.putTunnelConfiguration(tunnelId, config);
  console.log(`restored ${config.ingress.length} ingress rules`);
}

async function listCnames(zoneId: string) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=500&type=CNAME`, {
    headers: { authorization: `Bearer ${required("CLOUDFLARE_API_TOKEN")}` },
  });
  const body = (await response.json()) as { success: boolean; result?: Array<{ id: string; type: string; name: string; content: string }> };
  if (!body.success || !body.result) throw new Error(`Cannot list DNS records of zone ${zoneId}`);
  return body.result;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "create") return create(args[0] || "marczelloo-pi", uuid(args[1], "legacyTunnelId"));
  if (command === "token") {
    if (!args[1]) throw new Error("token <tunnelId> <file>");
    writeFileSync(args[1], `TUNNEL_TOKEN=${await client.getTunnelToken(uuid(args[0], "tunnelId"))}\n`, { mode: 0o600 });
    return console.log(`token written to ${args[1]}`);
  }
  if (command === "compare") return compare(uuid(args[0], "legacyTunnelId"), uuid(args[1], "tunnelId"));
  if (command === "switch-dns") {
    const flags = args.filter((arg) => arg.startsWith("--"));
    const hosts = args.slice(2).filter((arg) => !arg.startsWith("--"));
    return switchDns(uuid(args[0], "fromTunnelId"), uuid(args[1], "toTunnelId"), flags.includes("--apply"), hosts);
  }
  if (command === "edge") {
    if (!args[1]) throw new Error("edge <tunnelId> <bindings.json> [--extra port=origin] [--backup file] [--apply]");
    return edge(uuid(args[0], "tunnelId"), args[1], args.slice(2));
  }
  if (command === "restore") {
    if (!args[1]) throw new Error("restore <tunnelId> <backup.json>");
    return restore(uuid(args[0], "tunnelId"), args[1]);
  }
  throw new Error("Usage: create | token | compare | switch-dns | edge | restore (see the header of this file)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
