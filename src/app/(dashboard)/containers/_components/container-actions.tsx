"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Square, RotateCcw, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ContainerActionsProps {
  containerId: string;
  endpointId: number;
  isRunning: boolean;
}

export function ContainerActions({ containerId, endpointId, isRunning }: ContainerActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performAction(action: "start" | "stop" | "restart") {
    setActionInProgress(action);
    setError(null);

    try {
      const response = await fetch("/api/containers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId, action }),
      });

      const result = await response.json();

      if (result.success) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        setError(result.error || `Failed to ${action} container`);
      }
    } catch {
      setError(`Failed to ${action} container`);
    } finally {
      setActionInProgress(null);
    }
  }

  async function fetchLogs() {
    setLogsLoading(true);
    setLogsOpen(true);

    try {
      const response = await fetch("/api/containers/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId, tail: 100 }),
      });

      const result = await response.json();

      if (result.logs) {
        setLogs(result.logs);
      } else {
        setLogs(result.error || "Failed to fetch logs");
      }
    } catch {
      setLogs("Failed to fetch logs");
    } finally {
      setLogsLoading(false);
    }
  }

  const isLoading = isPending || actionInProgress !== null;

  return (
    <>
      <div className="flex items-center gap-1">
        {error && <span className="text-xs text-danger mr-2">{error}</span>}
        {isRunning ? (
          <>
            <Button variant="ghost" size="icon" title="Stop" disabled={isLoading} onClick={() => performAction("stop")}>
              {actionInProgress === "stop" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Restart"
              disabled={isLoading}
              onClick={() => performAction("restart")}
            >
              {actionInProgress === "restart" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" title="Start" disabled={isLoading} onClick={() => performAction("start")}>
            {actionInProgress === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" title="Logs" disabled={isLoading} onClick={fetchLogs}>
          <FileText className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Container Logs</DialogTitle>
            <DialogDescription>Last 100 lines from container {containerId.slice(0, 12)}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-secondary/50 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              logs || "No logs available"
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
