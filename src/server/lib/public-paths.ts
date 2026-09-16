// Endpoints reachable without a Cloudflare Access identity. Each one performs
// its own authentication: HMAC signature (webhook), CRON_SECRET (cron),
// AGENT_TOKEN (deploy agent events and tokens) or exposes nothing sensitive (health).
const PUBLIC_PATHS = new Set(["/api/health", "/api/github/webhook", "/api/cron/monitoring", "/api/agent/events", "/api/agent/token"]);

export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PATHS.has(normalized);
}
