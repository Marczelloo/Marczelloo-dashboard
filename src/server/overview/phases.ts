import type { DeployPhase } from "./types";

export const DEPLOY_PHASES: DeployPhase[] = ["fetch", "config", "build", "start", "health"];

/** Agent step labels (agent/src/pipeline.ts, agent/src/git.ts) grouped into the phases the UI shows. */
const RULES: Array<[RegExp, DeployPhase]> = [
  [/^(Rollback to |Restore previous |Rollback do |Przywracanie )/, "rollback"],
  [/^(Current commit|Check local changes|Git |Aktualny commit|Sprawdzenie lokalnych zmian)/, "fetch"],
  [/^(Compose config|Edge network|Validate Compose|Write |Sieć edge|Walidacja Compose|Zapis )/, "config"],
  [/^Build$/, "build"],
  [/^(Start containers|Uruchomienie)$/, "start"],
  [/^(Health check|Bramka zdrowia)$/, "health"],
];

export function deployPhase(step: string | null | undefined): DeployPhase | null {
  if (!step) return null;
  return RULES.find(([pattern]) => pattern.test(step))?.[1] ?? null;
}
