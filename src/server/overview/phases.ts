import type { DeployPhase } from "./types";

export const DEPLOY_PHASES: DeployPhase[] = ["fetch", "config", "build", "start", "health"];

/** Agent step labels (agent/src/pipeline.ts, agent/src/git.ts) grouped into the phases the UI shows. */
const RULES: Array<[RegExp, DeployPhase]> = [
  [/^(Rollback do |Przywracanie )/, "rollback"],
  [/^(Aktualny commit|Sprawdzenie lokalnych zmian|Git )/, "fetch"],
  [/^(Compose config|Sieć edge|Walidacja Compose|Zapis )/, "config"],
  [/^Build$/, "build"],
  [/^Uruchomienie$/, "start"],
  [/^Bramka zdrowia$/, "health"],
];

export function deployPhase(step: string | null | undefined): DeployPhase | null {
  if (!step) return null;
  return RULES.find(([pattern]) => pattern.test(step))?.[1] ?? null;
}
