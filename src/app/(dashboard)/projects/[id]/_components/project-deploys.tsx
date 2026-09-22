"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCommitHorizontal, Rocket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeployLogsButton } from "@/components/features/deploy-logs-button";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { StatusDot } from "@/components/status-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Chip,
  EmptyState,
  Panel,
  PanelHeader,
} from "@/components/ui";
import type { Tone } from "@/lib/tone";
import { formatRelativeTime } from "@/lib/utils";
import type { Deploy, DeployStatus, Service } from "@/types";

const TONE: Record<DeployStatus, Tone> = { pending: "live", running: "live", success: "ok", failed: "err", cancelled: "idle" };

function duration(deploy: Deploy): string {
  if (!deploy.finished_at) return "";
  const seconds = Math.max(0, Math.round((Date.parse(deploy.finished_at) - Date.parse(deploy.started_at)) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** This project's deploys, newest first, with their logs. */
export function ProjectDeploysClient({ projectId, deploys, services }: { projectId: string; deploys: Deploy[]; services: Service[] }) {
  const router = useRouter();
  const { run, dialog } = usePinGuard();
  const [clearing, setClearing] = useState(false);
  const serviceName = new Map(services.map((service) => [service.id, service.name]));
  const finished = deploys.filter((deploy) => deploy.status !== "running" && deploy.status !== "pending").length;

  async function clearHistory() {
    setClearing(true);
    try {
      const result = await run(async () => {
        const response = await fetch("/api/deploys/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        return (await response.json().catch(() => ({ success: false }))) as { success: boolean; deleted?: number; error?: string; requirePin?: boolean };
      });
      if (!result) return;
      if (!result.success) {
        toast.error(result.error ?? "Could not clear the history");
        return;
      }
      toast.success(`Cleared ${result.deleted ?? 0} deploy${result.deleted === 1 ? "" : "s"}`);
      router.refresh();
    } finally {
      setClearing(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Deploys"
        icon={Rocket}
        description={deploys.length ? `${deploys.length} on record` : undefined}
        actions={
          finished > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Clear finished deploys" disabled={clearing}>
                  <Trash2 strokeWidth={1.75} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear this project&apos;s deploy history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes {finished} finished deploy{finished === 1 ? "" : "s"} and their log links. Running and queued deploys stay. Other projects are not touched.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void clearHistory()} className="border-err/25 bg-err/10 text-err hover:bg-err/15">
                    Clear history
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />
      {deploys.length === 0 ? (
        <EmptyState icon={Rocket} title="No deploys yet" description="Push to the configured branch, or press Deploy above." className="py-8" />
      ) : (
        deploys.map((deploy) => {
          const name = serviceName.get(deploy.service_id) ?? "Unknown service";
          return (
            <div key={deploy.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
              <StatusDot status={TONE[deploy.status]} />
              <code className="flex w-[74px] items-center gap-1 text-[12px] text-fg-2">
                <GitCommitHorizontal className="size-3.5 text-fg-4" strokeWidth={1.75} />
                {deploy.commit_sha?.slice(0, 7) ?? "—"}
              </code>
              <span className="min-w-0 flex-1 truncate text-fg-2">{deploy.error_message ?? name}</span>
              <span className="ml-auto flex shrink-0 items-center gap-2 text-[11.5px] text-fg-3">
                {deploy.status !== "success" && <Chip tone={TONE[deploy.status]}>{deploy.status}</Chip>}
                <span className="max-w-[120px] truncate">{deploy.triggered_by}</span>
                <span className="w-[48px] text-right tabular-nums">{duration(deploy)}</span>
                <span className="w-[70px] truncate text-right text-fg-4">{formatRelativeTime(deploy.started_at)}</span>
                <DeployLogsButton logFile={deploy.logs_object_key ?? ""} deployId={deploy.id} serviceName={name} hasLogFile={Boolean(deploy.logs_object_key)} />
              </span>
            </div>
          );
        })
      )}
      {dialog}
    </Panel>
  );
}
