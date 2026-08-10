import { deploys as deploysRepo, services as servicesRepo } from "@/server/data";
import { RecentDeploysClient } from "./recent-deploys-client";

// Server component that fetches data
export async function RecentDeploysServer() {
  const [recentDeploys, allServices] = await Promise.all([
    deploysRepo.getRecentDeploys(10).catch((error) => {
      console.error("[RecentDeploys] Failed to load deployments:", error);
      return [];
    }),
    servicesRepo.getServices().catch((error) => {
      console.error("[RecentDeploys] Failed to load services:", error);
      return [];
    }),
  ]);

  return <RecentDeploysClient deploys={recentDeploys} services={allServices} />;
}
