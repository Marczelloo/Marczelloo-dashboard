import "server-only";

import { getAgentHost, getAgentStatus, isAgentConfigured } from "@/server/agent/client";
import { demoAgentStatus, demoHostHistory, demoHostInfo } from "@/server/demo/host";
import { ttlCache } from "@/server/lib/ttl-cache";
import { isDemoMode } from "@/lib/demo-mode";
import { hostAlerts, type HostSummary } from "@/lib/host";

/**
 * Everything the host page reads in one call: the agent's host report and its
 * own status. Cached briefly so a tab switch or a second viewer costs nothing.
 */
const load = ttlCache<HostSummary>(5_000, async () => {
  if (isDemoMode()) {
    const host = demoHostInfo();
    const agent = demoAgentStatus();
    return { generatedAt: new Date().toISOString(), reachable: true, host, agent, alerts: hostAlerts(host, agent), history: demoHostHistory() };
  }

  if (!isAgentConfigured()) {
    return { generatedAt: new Date().toISOString(), reachable: false, host: null, agent: null, alerts: [] };
  }

  const [host, agent] = await Promise.all([getAgentHost().catch(() => null), getAgentStatus().catch(() => null)]);
  return {
    generatedAt: new Date().toISOString(),
    reachable: host !== null,
    host,
    agent,
    alerts: host ? hostAlerts(host, agent) : [],
  };
});

export function getHostSummary(): Promise<HostSummary> {
  return load();
}
