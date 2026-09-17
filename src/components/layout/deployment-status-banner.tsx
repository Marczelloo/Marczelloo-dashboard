"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { LiveDeployLogs } from "@/components/features/live-deploy-logs";

interface SelfDeployment {
  commit: string | null;
  activeJob: { jobId: string; kind: string; logFile: string } | null;
}

/**
 * Shows a running agent job for the dashboard itself and offers a reload once
 * a different release than the one this page was loaded with goes live.
 */
export function DeploymentStatusBanner({ loadedCommit }: { loadedCommit: string | null }) {
  const [deployment, setDeployment] = useState<SelfDeployment | null>(null);
  const [dismissedCommit, setDismissedCommit] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const response = await fetch("/api/deployment/status", { cache: "no-store" });
        if (response.ok && mounted) setDeployment((await response.json()) as SelfDeployment);
      } catch {
        // The dashboard restarts during its own deploy; the next poll catches up.
      }
    }
    void check();
    const interval = setInterval(check, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!deployment) return null;
  const job = deployment.activeJob;
  const newRelease = !job && loadedCommit && deployment.commit && deployment.commit !== loadedCommit && deployment.commit !== dismissedCommit;
  if (!job && !newRelease) return null;

  return (
    <div className={`mx-3 mt-2 rounded border px-3 py-2 ${job ? "border-blue-500/20 bg-blue-500/10 text-blue-500" : "border-green-500/20 bg-green-500/10 text-green-500"}`}>
      <div className="flex items-start gap-2">
        {job ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase">{job ? "Agent wdraża dashboard" : "Nowa wersja dashboardu"}</p>
          {!job && deployment.commit && <p className="mt-0.5 font-mono text-[9px] opacity-60">{deployment.commit.slice(0, 8)}</p>}
        </div>
        {newRelease && (
          <>
            <Button size="sm" variant="ghost" className="h-auto px-2 py-1 text-[10px]" onClick={() => window.location.reload()}>
              Przeładuj
            </Button>
            <button onClick={() => setDismissedCommit(deployment.commit)} className="text-[10px] opacity-60 hover:opacity-100" aria-label="Ukryj">
              ✕
            </button>
          </>
        )}
      </div>
      {job && <LiveDeployLogs logFile={job.logFile} isRunning defaultExpanded={false} className="mt-2" />}
    </div>
  );
}
