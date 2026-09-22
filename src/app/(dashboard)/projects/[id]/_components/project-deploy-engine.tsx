"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getDeployEngineAction, rollbackProjectAction } from "@/app/actions/agent-deploy";
import { PinDialog } from "@/components/pin-dialog";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, Panel, PanelHeader } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";

type EngineData = NonNullable<Awaited<ReturnType<typeof getDeployEngineAction>>["data"]>;

const JOB_STATUS: Record<string, string> = { queued: "queued", running: "deploying" };

/** Releases the agent keeps for this project, and rollback to any of them. */
export function ProjectDeployEngine({ projectId }: { projectId: string }) {
  const [data, setData] = useState<EngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingSha, setPendingSha] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDeployEngineAction(projectId);
    if (result.success && result.data) setData(result.data);
    else toast.error("Could not read the releases", { description: result.error });
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rollback(sha: string) {
    setBusy(true);
    const result = await rollbackProjectAction(projectId, sha);
    setBusy(false);
    if (result.code === "PIN_REQUIRED") {
      setPendingSha(sha);
      return;
    }
    if (!result.success) {
      toast.error("The rollback was not queued", { description: result.error });
      return;
    }
    toast.success(`Rolling back to ${sha.slice(0, 7)}`);
    await load();
  }

  if (loading && !data) {
    return (
      <Panel>
        <PanelHeader title="Releases" icon={History} />
        <p className="flex items-center gap-2 p-3.5 text-[13px] text-fg-3">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </p>
      </Panel>
    );
  }
  if (!data?.managed) return null;

  const agent = data.engine === "agent";
  const [current, ...previous] = data.releases;

  return (
    <Panel>
      <PanelHeader title="Releases" icon={History} description={agent ? "Built images the agent keeps, newest first." : undefined} />
      {!agent ? (
        <p className="p-3.5 text-[13px] text-fg-3">This project is not deployed by the agent yet. Save its deploy settings again.</p>
      ) : (
        <div className="grid">
          {data.agentError && <p className="border-b border-line-subtle px-3.5 py-2.5 text-[12.5px] text-err">{data.agentError}</p>}
          {data.activeJob && (
            <p className="flex items-center gap-2 border-b border-line-subtle px-3.5 py-2.5 text-[13px]">
              <StatusDot status="live" />
              {JOB_STATUS[data.activeJob.status] ?? data.activeJob.status}
              <code className="text-[12px] text-fg-2">{data.activeJob.sha.slice(0, 7)}</code>
            </p>
          )}
          {!current ? (
            <p className="p-3.5 text-[13px] text-fg-3">The agent has not deployed this project yet.</p>
          ) : (
            [current, ...previous].map((release, index) => (
              <div key={release.sha} className="flex items-center gap-2 px-3.5 py-2 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
                <code className="text-[12px] text-fg-2">{release.sha.slice(0, 7)}</code>
                <span className="text-[11.5px] text-fg-3">{formatRelativeTime(release.deployedAt)}</span>
                <span className="ml-auto">
                  {index === 0 ? (
                    <Chip tone="ok">live</Chip>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={busy || Boolean(data.activeJob)} onClick={() => void rollback(release.sha)}>
                      <RotateCcw strokeWidth={1.75} />
                      Roll back
                    </Button>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}
      <PinDialog
        open={pendingSha !== null}
        onCancel={() => setPendingSha(null)}
        onSuccess={() => {
          const retry = pendingSha;
          setPendingSha(null);
          if (retry) void rollback(retry);
        }}
      />
    </Panel>
  );
}
