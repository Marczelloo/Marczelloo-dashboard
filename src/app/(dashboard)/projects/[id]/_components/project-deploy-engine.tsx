"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getDeployEngineAction, rollbackProjectAction } from "@/app/actions/agent-deploy";
import { PinDialog } from "@/components/pin-dialog";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type EngineData = NonNullable<Awaited<ReturnType<typeof getDeployEngineAction>>["data"]>;
type PendingAction = { kind: "rollback"; sha: string };

const JOB_STATUS: Record<string, string> = { queued: "w kolejce", running: "w toku" };
const formatDate = (value: string) => new Date(value).toLocaleString("pl-PL");

export function ProjectDeployEngine({ projectId }: { projectId: string }) {
  const [data, setData] = useState<EngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDeployEngineAction(projectId);
    if (result.success && result.data) setData(result.data);
    else toast.error("Could not read the deploy setup", { description: result.error });
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function execute(action: PendingAction) {
    setBusy(true);
    const result = await rollbackProjectAction(projectId, action.sha);
    setBusy(false);
    if (result.code === "PIN_REQUIRED") {
      setPending(action);
      return;
    }
    if (!result.success) {
      toast.error("The rollback was not queued", { description: result.error });
      return;
    }
    toast.success("Rollback queued on the agent");
    await load();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading the deploy setup…
        </CardContent>
      </Card>
    );
  }
  if (!data?.managed) return null;

  const agent = data.engine === "agent";
  const [current, ...previous] = data.releases;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Wydania
          </CardTitle>
          <CardDescription>
            {agent
              ? "Agent: kolejka, obrazy z tagiem commita, bramka zdrowia i automatyczny rollback."
              : "This project is not deployed by the agent yet. Save its deploy settings again."}
          </CardDescription>
        </CardHeader>
        {agent && (
          <CardContent className="space-y-3 text-sm">
            {data.agentError && <p className="text-danger">{data.agentError}</p>}
            {data.activeJob && (
              <p>
                Zadanie {JOB_STATUS[data.activeJob.status] ?? data.activeJob.status}: <span className="font-mono">{data.activeJob.sha.slice(0, 7)}</span>
              </p>
            )}
            {current ? (
              <div className="flex flex-wrap items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Aktualna wersja
                <Badge variant="success" className="font-mono">
                  {current.sha.slice(0, 7)}
                </Badge>
                <span className="text-muted-foreground">{formatDate(current.deployedAt)}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">The agent has not deployed this project yet.</p>
            )}
            {previous.length > 0 && (
              <ul className="space-y-1">
                {previous.map((release) => (
                  <li key={release.sha} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-mono">{release.sha.slice(0, 7)}</span> <span className="text-muted-foreground">{formatDate(release.deployedAt)}</span>
                    </span>
                    <Button variant="outline" size="sm" disabled={busy || Boolean(data.activeJob)} onClick={() => execute({ kind: "rollback", sha: release.sha })}>
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>
      <PinDialog
        open={pending !== null}
        onCancel={() => setPending(null)}
        onSuccess={() => {
          const retry = pending;
          setPending(null);
          if (retry) void execute(retry);
        }}
      />
    </>
  );
}
