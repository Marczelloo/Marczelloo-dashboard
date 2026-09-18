import { headers } from "next/headers";
import { isDemoMode } from "@/lib/demo-mode";
import { getSelfVersion } from "@/server/agent/self-version";
import { getHostSummary } from "@/server/host/summary";
import { SettingsView, type SettingsData } from "./_components/settings-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [summary, version, headerList] = await Promise.all([
    getHostSummary().catch(() => null),
    isDemoMode() ? Promise.resolve(null) : getSelfVersion().catch(() => null),
    headers(),
  ]);

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3100";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const data: SettingsData = {
    version: version?.shortCommit ?? (isDemoMode() ? "demo" : "unknown"),
    demo: isDemoMode(),
    agentReachable: summary?.reachable ?? false,
    discordConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL),
    host: {
      hostname: summary?.host?.hostname ?? null,
      projectsDir: process.env.PROJECTS_DIR ?? null,
      edgeNetwork: process.env.EDGE_NETWORK ?? null,
      dropPorts: process.env.EDGE_DROP_PORTS === "true",
    },
    origin: `${protocol}://${host}`,
  };

  return <SettingsView data={data} />;
}
