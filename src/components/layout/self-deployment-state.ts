import type { SelfDeployment } from "@/server/agent/self-version";

export type SelfDeployState = "deploying" | "new-version" | null;

export function selfDeployState(deployment: SelfDeployment | null, loadedCommit: string | null, dismissedCommit: string | null): SelfDeployState {
  if (!deployment) return null;
  if (deployment.activeJob) return "deploying";
  if (loadedCommit && deployment.commit && deployment.commit !== loadedCommit && deployment.commit !== dismissedCommit) return "new-version";
  return null;
}
