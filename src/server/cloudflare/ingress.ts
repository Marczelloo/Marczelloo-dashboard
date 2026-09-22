export interface TunnelIngressRule {
  hostname?: string;
  path?: string;
  service: string;
  originRequest?: Record<string, unknown>;
}

export interface TunnelConfiguration {
  ingress: TunnelIngressRule[];
  [key: string]: unknown;
}

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function isSafeHostname(value: string): boolean {
  return HOSTNAME.test(value);
}

export function localService(port: number): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("The tunnel port must be a number from 1 to 65535.");
  return `http://127.0.0.1:${port}`;
}

export function assertCatchAll(rules: TunnelIngressRule[]): void {
  const last = rules.at(-1);
  if (!last || last.hostname || last.path) throw new Error("The tunnel configuration must end with a catch-all rule without a hostname.");
}

const matches = (rule: TunnelIngressRule, hostname: string) => rule.hostname?.toLowerCase() === hostname;

/**
 * Points a hostname at a new service without reordering the ingress list.
 * Path rules of the same hostname follow the change only when they served the
 * same origin (e.g. the dashboard webhook rule); rules with their own origin stay.
 */
export function upsertHostnameRoute(rules: TunnelIngressRule[], hostname: string, service: string): TunnelIngressRule[] {
  const host = hostname.trim().toLowerCase();
  if (!isSafeHostname(host)) throw new Error("Invalid tunnel domain.");
  assertCatchAll(rules);
  const primary = rules.find((rule) => matches(rule, host) && !rule.path);
  if (!primary) return [...rules.slice(0, -1), { hostname: host, service }, rules.at(-1)!];
  return rules.map((rule) => (matches(rule, host) && (!rule.path || rule.service === primary.service) ? { ...rule, service } : rule));
}

export function removeHostnameRoutes(rules: TunnelIngressRule[], hostnames: string[]): TunnelIngressRule[] {
  const remove = new Set(hostnames.map((hostname) => hostname.trim().toLowerCase()));
  assertCatchAll(rules);
  return rules.filter((rule) => !rule.hostname || !remove.has(rule.hostname.toLowerCase()));
}

export function sameIngress(a: TunnelIngressRule[], b: TunnelIngressRule[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function parseLocalPort(service: string): number | null {
  const match = /^https?:\/\/(?:127\.0\.0\.1|localhost):(\d{1,5})\/?$/.exec(service.trim());
  const port = match ? Number(match[1]) : NaN;
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}
