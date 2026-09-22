"use client";

import Link from "next/link";
import { Check, FileText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/status-dot";
import { cn, formatRelativeTime } from "@/lib/utils";
import { DEPLOY_PHASES } from "@/server/overview/phases";
import type { DeployPhase, FleetRow } from "@/server/overview/types";

const PHASE_LABEL: Record<DeployPhase, string> = { fetch: "Fetch", config: "Config", build: "Build", start: "Start", health: "Health", rollback: "Rolling back" };

function Elapsed({ since }: { since: string | null }) {
  if (!since) return null;
  return <span className="font-mono text-xs text-fg-3">started {formatRelativeTime(since)}</span>;
}

export function AttentionDetail({ row }: { row: FleetRow }) {
  const guard = usePinGuard();
  const attention = row.attention;
  if (!attention) return null;

  if (attention.kind === "deploying") {
    const current = attention.phase === "rollback" ? -1 : attention.phase ? DEPLOY_PHASES.indexOf(attention.phase) : -1;
    const progress = attention.phase === "rollback" ? 100 : current < 0 ? 8 : ((current + 0.5) / DEPLOY_PHASES.length) * 100;
    return (
      <div className="pb-3.5 pl-[31px] pr-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {attention.phase === "rollback" ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-warn/30 bg-warn/10 px-2 text-xs text-warn">
              <RotateCcw className="size-3" strokeWidth={1.75} /> Rolling back
            </span>
          ) : (
            DEPLOY_PHASES.map((phase, index) => (
              <span key={phase} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden className="h-px w-2.5 bg-line-strong" />}
                <span
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs",
                    index < current && "border-line text-fg-2",
                    index === current && "border-accent/40 bg-accent/10 text-white",
                    index > current && "border-line-subtle text-fg-4"
                  )}
                >
                  {index < current && <Check className="size-3 text-ok" strokeWidth={2} />}
                  {index === current && <StatusDot status="live" size="sm" />}
                  {PHASE_LABEL[phase]}
                </span>
              </span>
            ))
          )}
          <span className="ml-auto flex items-center gap-3">
            <code className="text-xs text-fg-2">{attention.sha.slice(0, 7)}</code>
            <Elapsed since={attention.startedAt} />
          </span>
        </div>
        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/[.06]">
          <div className="h-full rounded-full bg-info shadow-[0_0_12px_rgb(var(--info)/.6)] transition-[width] duration-1000 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  const restart = async () => {
    if (!row.serviceId) return;
    const result = await guard.run(async () => {
      const response = await fetch(`/api/services/${row.serviceId}/restart`, { method: "POST" });
      return (await response.json()) as { success: boolean; error?: string; requirePin?: boolean; message?: string };
    });
    if (!result) return;
    if (result.success) toast.success(`Restarting ${row.name}`, { description: result.message });
    else toast.error(`Could not restart ${row.name}`, { description: result.error });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-7 gap-y-3 pb-3.5 pl-[31px] pr-3.5">
      {attention.container && (
        <div className="text-[11.5px] text-fg-3">
          Container
          <code className="mt-0.5 block text-[13px] text-fg">{attention.container.name}</code>
        </div>
      )}
      <div className="min-w-0 text-[11.5px] text-fg-3">
        {attention.kind === "down" ? "Failing" : "Degraded"}
        <span className="mt-0.5 block truncate text-[13px] font-medium text-fg">{attention.reason}</span>
      </div>
      <div className="text-[11.5px] text-fg-3">
        Since
        <span className="mt-0.5 block font-mono text-[13px] text-fg">{formatRelativeTime(attention.since)}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {row.serviceId && (
          <Button size="sm" onClick={() => void restart()}>
            <RotateCcw strokeWidth={1.75} />
            Restart {attention.container?.service ?? row.name}
          </Button>
        )}
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/projects/${row.projectId}?tab=deployments`}>
            <FileText strokeWidth={1.75} />
            Logs
          </Link>
        </Button>
      </div>
      {guard.dialog}
    </div>
  );
}
