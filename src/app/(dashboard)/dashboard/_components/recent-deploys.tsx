import { deploys as deploysRepo, services as servicesRepo } from "@/server/data";
import { RecentDeploysClient } from "./recent-deploys-client";

// Server component that fetches data
export async function RecentDeploysServer() {
  const [recentDeploys, allServices] = await Promise.all([
    deploysRepo.getRecentDeploys(10),
    servicesRepo.getServices(),
  ]);

  return <RecentDeploysClient deploys={recentDeploys} services={allServices} />;
}
