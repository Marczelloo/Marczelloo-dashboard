"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Square, RotateCcw, FileText, Loader2, RefreshCw, Trash2, MoreHorizontal, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";

interface ContainerActionsProps {
  containerId: string;
  endpointId: number;
  status: "running" | "stopped" | "unhealthy" | "unknown";
}

const LOG_TAIL_SIZE = 1000; // Fetch last 1000 lines

export function ContainerActions({ containerId, endpointId, status }: ContainerActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isRunning = status === "running" || status === "unhealthy";

  async function performAction(action: "start" | "stop" | "restart" | "kill" | "remove") {
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
      setConfirmRemove(false);
    }
  }

  async function fetchLogs() {
    setLogsLoading(true);
    setLogsOpen(true);
    setLogs(""); // Clear previous logs

    try {
      const response = await fetch("/api/containers/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId, tail: LOG_TAIL_SIZE }),
      });

      const result = await response.json();

      if (!response.ok) {
        setLogs(`Error (${response.status}): ${result.error || "Failed to fetch logs"}`);
        return;
      }

      if (result.logs) {
        setLogs(result.logs);
      } else if (result.error) {
        setLogs(`Error: ${result.error}`);
      } else {
        setLogs("No logs available");
      }
    } catch (err) {
      setLogs(`Network error: ${err instanceof Error ? err.message : "Failed to fetch logs"}`);
    } finally {
      setLogsLoading(false);
    }
  }

  const isLoading = isPending || actionInProgress !== null;

  return (
    <>
      <div className="flex items-center gap-1">
        {error && <span className="text-xs text-danger mr-2">{error}</span>}

        {/* Primary actions based on status */}
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

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isLoading}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/containers/${endpointId}/${containerId}`}>
                <Info className="h-4 w-4 mr-2" />
                Inspect
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={fetchLogs}>
              <FileText className="h-4 w-4 mr-2" />
              View Logs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isRunning && (
              <DropdownMenuItem onClick={() => performAction("kill")} className="text-warning">
                <Square className="h-4 w-4 mr-2" />
                Kill (Force Stop)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setConfirmRemove(true)} className="text-danger">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Container
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Container?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the container {containerId.slice(0, 12)}.
              {isRunning && " The container is currently running and will be force stopped."}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performAction("remove")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionInProgress === "remove" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Container Logs</DialogTitle>
                <DialogDescription>
                  Last {LOG_TAIL_SIZE} lines from container {containerId.slice(0, 12)}
                </DialogDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={logsLoading} className="mr-8">
                {logsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-secondary/50 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap">
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
