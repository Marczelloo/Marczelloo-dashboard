import { getOverview } from "@/server/overview";
import { OverviewView } from "./_overview/overview-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const overview = await getOverview().catch((error) => {
    console.error("[overview] Initial load failed:", error);
    return null;
  });
  return <OverviewView initial={overview} />;
}
