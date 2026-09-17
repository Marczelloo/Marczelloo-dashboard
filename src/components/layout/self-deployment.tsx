"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SelfDeployment } from "@/server/agent/self-version";
import { selfDeployState, type SelfDeployState } from "./self-deployment-state";

interface SelfDeploymentValue {
  deployment: SelfDeployment | null;
  state: SelfDeployState;
  dismiss(): void;
}

const SelfDeploymentContext = createContext<SelfDeploymentValue>({ deployment: null, state: null, dismiss: () => undefined });

/** Polls the dashboard's own deploy status every 10 s; shared by the top bar and the sidebar mark. */
export function SelfDeploymentProvider({ children }: { children: React.ReactNode }) {
  const [deployment, setDeployment] = useState<SelfDeployment | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  /** Release this page was served with; the reload prompt compares against it. */
  const [loadedCommit, setLoadedCommit] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const response = await fetch("/api/deployment/status", { cache: "no-store" });
        if (!response.ok || !mounted) return;
        const next = (await response.json()) as SelfDeployment;
        if (next.commit && !next.activeJob) setLoadedCommit((current) => current ?? next.commit);
        setDeployment(next);
      } catch {
        // The dashboard restarts during its own deploy; the next poll catches up.
      }
    };
    void check();
    const interval = setInterval(check, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const value: SelfDeploymentValue = {
    deployment,
    state: selfDeployState(deployment, loadedCommit, dismissed),
    dismiss: () => setDismissed(deployment?.commit ?? null),
  };
  return <SelfDeploymentContext.Provider value={value}>{children}</SelfDeploymentContext.Provider>;
}

export function useSelfDeployment(): SelfDeploymentValue {
  return useContext(SelfDeploymentContext);
}
