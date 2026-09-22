"use client";

import Link from "next/link";
import { ExternalLink, FileText, Pin, PinOff, RotateCcw, Rocket } from "lucide-react";
import { toast } from "sonner";
import { deployProjectAction } from "@/app/actions/projects";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { UptimeStrip } from "@/components/ui/uptime-strip";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { FleetRow } from "@/server/overview/types";

const EDGE = {
  deploying: "border-line-strong",
  down: "border-err/30 bg-[linear-gradient(180deg,rgb(var(--err)/.05),transparent_45%)]",
  degraded: "border-warn/25 bg-[linear-gradient(180deg,rgb(var(--warn)/.04),transparent_45%)]",
} as const;

function StateChip({ row }: { row: FleetRow }) {
  const attention = row.attention;
  if (attention?.kind === "deploying") {
    return (
      <Chip tone="live">
        <StatusDot status="live" size="sm" />
        Deploying
      </Chip>
    );
  }
  if (attention) return <Chip tone={attention.kind === "down" ? "err" : "warn"}>{attention.kind === "down" ? "Down" : "Degraded"}</Chip>;
  // Healthy when something watches it, otherwise unwatched; container counts live in the stats row.
  return row.tone === "idle" && !row.containers ? <Chip tone="idle">Not monitored</Chip> : <Chip tone="ok">Healthy</Chip>;
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10.5px] text-fg-3">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ProjectCard({ row, pinned, onTogglePin }: { row: FleetRow; pinned: boolean; onTogglePin(id: string): void }) {
  const guard = usePinGuard();
  const attention = row.attention;

  const deploy = async () => {
    const result = await guard.run(() => deployProjectAction(row.projectId));
    if (!result) return;
    if (result.success) toast.success(`Deploying ${row.name}`, { description: "Follow it on the Overview or the project's Deployments tab." });
    else toast.error(`Could not deploy ${row.name}`, { description: result.error });
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-lg border border-line bg-surface bg-sheen p-3.5 shadow-inset-top transition-[border-color,transform] duration-base ease-out hover:-translate-y-px hover:border-line-strong",
        attention && EDGE[attention.kind]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/projects/${row.projectId}`} className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <StatusDot status={row.tone} />
            <span className="truncate">{row.name}</span>
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-fg-3">{row.domain ?? "no domain"}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <StateChip row={row} />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={pinned ? `Unpin ${row.name}` : `Pin ${row.name}`}
            aria-pressed={pinned}
            onClick={() => onTogglePin(row.projectId)}
            className={cn("transition-opacity duration-quick", pinned ? "text-accent" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100")}
          >
            {pinned ? <PinOff strokeWidth={1.75} /> : <Pin strokeWidth={1.75} />}
          </Button>
        </div>
      </div>

      <UptimeStrip buckets={row.uptime} className="h-3" />

      <div className="grid grid-cols-3 gap-3">
        <Figure label="Services" value={row.services} />
        <Figure label="Open tasks" value={row.openTasks} />
        <Figure label="Deploys 7 d" value={row.deploys7d} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5 text-[11.5px] text-fg-3">
        <span className="min-w-0 truncate">
          {attention?.kind === "deploying" ? (
            <span className="text-fg-2">Deploying…</span>
          ) : row.lastDeploy ? (
            <>
              {formatRelativeTime(row.lastDeploy.at)}
              {row.lastDeploy.sha && <code className="ml-1.5 text-fg-2">{row.lastDeploy.sha.slice(0, 7)}</code>}
            </>
          ) : (
            "never deployed"
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {attention?.kind === "deploying" ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/projects/${row.projectId}?tab=deployments`}>
                <FileText strokeWidth={1.75} />
                Live logs
              </Link>
            </Button>
          ) : attention ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/projects/${row.projectId}`}>
                <RotateCcw strokeWidth={1.75} />
                {attention.container ? `Fix ${attention.container.service}` : "Open"}
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void deploy()}>
              <Rocket strokeWidth={1.75} />
              Deploy
            </Button>
          )}
          {row.domain && (
            <Button size="icon-sm" variant="ghost" asChild>
              <a href={`https://${row.domain}`} target="_blank" rel="noreferrer" aria-label={`Open ${row.domain}`}>
                <ExternalLink strokeWidth={1.75} />
              </a>
            </Button>
          )}
        </span>
      </div>
      {guard.dialog}
    </div>
  );
}
