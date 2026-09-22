"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, FileText, Rocket } from "lucide-react";
import { toast } from "sonner";
import { deployProjectAction } from "@/app/actions/projects";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { UptimeStrip } from "@/components/ui/uptime-strip";
import { StatusDot } from "@/components/status-dot";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { FleetRow as Row } from "@/server/overview/types";
import { AttentionDetail } from "./attention-detail";

const EDGE = { deploying: "before:bg-fg-3", down: "before:bg-err bg-[linear-gradient(90deg,rgb(var(--err)/.06),transparent_55%)]", degraded: "before:bg-warn bg-[linear-gradient(90deg,rgb(var(--warn)/.05),transparent_55%)]" } as const;

export const FLEET_COLUMNS = "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(170px,1.3fr)_minmax(140px,1.3fr)_90px_minmax(120px,1fr)_160px]";

/** `enterDelay` staggers rows on the first render of the table only (30 ms per row, capped at 8). */
export function FleetRow({ row, enterDelay = 0 }: { row: Row; enterDelay?: number }) {
  const guard = usePinGuard();
  const attention = row.attention;

  const deploy = async () => {
    const result = await guard.run(() => deployProjectAction(row.projectId));
    if (!result) return;
    if (result.success) toast.success(`Deploying ${row.name}`, { description: "It will rise to the top while it runs." });
    else toast.error(`Could not deploy ${row.name}`, { description: result.error });
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: enterDelay, ease: [0.16, 1, 0.3, 1], layout: { duration: 0.42, ease: [0.65, 0, 0.35, 1] } }}
      className={cn(
        "group relative border-t border-line-subtle transition-colors duration-quick hover:bg-white/[.022]",
        attention && ["before:absolute before:inset-y-0 before:left-0 before:w-0.5", EDGE[attention.kind]]
      )}
    >
      <div className={cn("grid min-h-[52px] items-center gap-4 px-3.5", FLEET_COLUMNS)}>
        <Link href={`/projects/${row.projectId}`} className="flex min-w-0 items-center gap-2.5 rounded-sm">
          <StatusDot status={row.tone} label={attention ? attention.kind : row.tone === "idle" ? "not monitored" : "healthy"} />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-medium text-fg">{row.name}</span>
            <span className="block truncate font-mono text-[11.5px] text-fg-3">{row.domain ?? "no domain"}</span>
          </span>
        </Link>
        <UptimeStrip buckets={row.uptime} className="hidden md:flex" />
        <div className="hidden md:block">
          {row.containers ? (
            <Chip tone={row.containers.running < row.containers.total ? "warn" : "neutral"}>
              {row.containers.running} / {row.containers.total}
            </Chip>
          ) : (
            <span className="text-xs text-fg-4">—</span>
          )}
        </div>
        <div className="hidden truncate text-[12.5px] text-fg-3 md:block">
          {attention?.kind === "deploying" ? (
            <span className="text-fg-2">deploying…</span>
          ) : row.lastDeploy ? (
            <>
              {formatRelativeTime(row.lastDeploy.at)}
              {row.lastDeploy.sha && <code className="ml-1.5 text-fg-2">{row.lastDeploy.sha.slice(0, 7)}</code>}
            </>
          ) : (
            "never"
          )}
        </div>
        <div className={cn("flex justify-end gap-1.5 transition-[opacity,transform] duration-base ease-out md:translate-x-1.5 md:opacity-0 md:group-focus-within:translate-x-0 md:group-focus-within:opacity-100 md:group-hover:translate-x-0 md:group-hover:opacity-100", attention && "md:translate-x-0 md:opacity-100")}>
          {attention?.kind === "deploying" ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/projects/${row.projectId}?tab=deployments`}>
                <FileText strokeWidth={1.75} />
                Live logs
              </Link>
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => void deploy()} aria-label={`Deploy ${row.name}`}>
                <Rocket strokeWidth={1.75} />
                <span className="hidden sm:inline">Deploy</span>
              </Button>
              {row.domain && (
                <Button size="icon-sm" variant="ghost" asChild>
                  <a href={`https://${row.domain}`} target="_blank" rel="noreferrer" aria-label={`Open ${row.domain}`}>
                    <ExternalLink strokeWidth={1.75} />
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-panel ease-out", attention ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className={cn("transition-[opacity,transform] duration-base ease-out", attention ? "translate-y-0 opacity-100 delay-75" : "-translate-y-1 opacity-0")}>
            <AttentionDetail row={row} />
          </div>
        </div>
      </div>
      {guard.dialog}
    </motion.div>
  );
}
