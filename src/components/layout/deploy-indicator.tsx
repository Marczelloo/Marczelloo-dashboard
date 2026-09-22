"use client";

import { RefreshCw, X } from "lucide-react";
import { LiveDeployLogs } from "@/components/features/live-deploy-logs";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSelfDeployment } from "./self-deployment";

export function DeployIndicator() {
  const { deployment, state, dismiss } = useSelfDeployment();
  if (!state || !deployment) return null;

  if (state === "new-version") {
    return (
      <div className="flex h-[30px] items-center gap-1 rounded-sm border border-ok/25 bg-ok/10 pl-2.5 pr-1 text-xs text-ok">
        <RefreshCw className="size-3.5" strokeWidth={1.75} />
        <span className="hidden sm:inline">New version</span>
        <Button size="sm" variant="ghost" className="h-6 text-ok hover:bg-ok/10 hover:text-ok" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button size="icon-sm" variant="ghost" className="size-6 text-ok/70 hover:text-ok" onClick={dismiss} aria-label="Dismiss new version">
          <X />
        </Button>
      </div>
    );
  }

  const job = deployment.activeJob!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-[30px] items-center gap-2 whitespace-nowrap rounded-sm border border-info/35 bg-info/10 px-2.5 text-xs text-info transition-colors duration-quick hover:bg-info/15">
          <StatusDot status="live" size="sm" />
          <span className="hidden sm:inline">Deploying dashboard</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(560px,calc(100vw-2rem))] p-3">
        <LiveDeployLogs logFile={job.logFile} isRunning defaultExpanded />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
