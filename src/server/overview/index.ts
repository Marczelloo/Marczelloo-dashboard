import "server-only";

import { isDemoMode } from "@/lib/demo-mode";
import { ttlCache } from "@/server/lib/ttl-cache";
import { assembleOverview } from "./assemble";
import { demoOverviewInputs } from "./demo";
import { loadDatabaseInputs, loadLiveInputs } from "./sources";
import type { Overview } from "./types";

const databaseInputs = ttlCache(30_000, loadDatabaseInputs);
const liveInputs = ttlCache(5_000, loadLiveInputs);

export async function getOverview(): Promise<Overview> {
  const now = new Date();
  if (isDemoMode()) return assembleOverview(demoOverviewInputs(now), now);
  const [database, live] = await Promise.all([databaseInputs(), liveInputs()]);
  return assembleOverview({ ...database, ...live }, now);
}

export type { Overview } from "./types";
