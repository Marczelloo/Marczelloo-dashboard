import { getHostSummary } from "@/server/host/summary";
import { HostView } from "./_components/host-view";
import { hostTabFrom } from "./_components/host-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host" };

export default async function HostPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const summary = await getHostSummary().catch(() => ({ generatedAt: new Date().toISOString(), reachable: false, host: null, agent: null, alerts: [] }));
  return <HostView initial={summary} tab={hostTabFrom(tab)} />;
}
