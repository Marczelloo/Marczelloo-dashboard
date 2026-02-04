"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play,
  Square,
  RotateCcw,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  Info,
  Terminal,
  Send,
} from "lucide-react";
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
  containerName: string;
  endpointId: number;
  status: "running" | "stopped" | "unhealthy" | "unknown";
}

interface TerminalEntry {
  type: "command" | "stdout" | "stderr" | "error";
  content: string;
  timestamp: Date;
}

const LOG_TAIL_SIZE = 1000; // Fetch last 1000 lines

export function ContainerActions({ containerId, containerName, endpointId, status }: ContainerActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([]);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalHistory.length > 0 && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalHistory]);

  // Focus terminal input when dialog opens
  useEffect(() => {
    if (terminalOpen && terminalInputRef.current) {
      setTimeout(() => terminalInputRef.current?.focus(), 100);
    }
  }, [terminalOpen]);

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

  async function executeCommand() {
    if (!terminalCommand.trim() || terminalLoading) return;

    const command = terminalCommand.trim();
    setTerminalCommand("");
    setTerminalLoading(true);

    // Add command to history
    setTerminalHistory((prev) => [...prev, { type: "command", content: command, timestamp: new Date() }]);

    try {
      const response = await fetch("/api/containers/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerName, command }),
      });

      const result = await response.json();

      if (result.stdout) {
        setTerminalHistory((prev) => [...prev, { type: "stdout", content: result.stdout, timestamp: new Date() }]);
      }

      if (result.stderr) {
        setTerminalHistory((prev) => [...prev, { type: "stderr", content: result.stderr, timestamp: new Date() }]);
      }

      if (result.error && !result.stdout && !result.stderr) {
        setTerminalHistory((prev) => [...prev, { type: "error", content: result.error, timestamp: new Date() }]);
      }
    } catch (err) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          type: "error",
          content: err instanceof Error ? err.message : "Failed to execute command",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setTerminalLoading(false);
      terminalInputRef.current?.focus();
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
            {isRunning && (
              <DropdownMenuItem onClick={() => setTerminalOpen(true)}>
                <Terminal className="h-4 w-4 mr-2" />
                Terminal (Exec)
              </DropdownMenuItem>
            )}
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
              <>
                {logs || "No logs available"}
                <div ref={logsEndRef} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Terminal Dialog */}
      <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Terminal - {containerName}
            </DialogTitle>
            <DialogDescription>
              Execute commands inside the container. Use caution with destructive commands.
            </DialogDescription>
          </DialogHeader>

          {/* Terminal output area */}
          <div className="flex-1 min-h-0 overflow-auto bg-zinc-950 rounded-lg p-4 font-mono text-sm">
            {terminalHistory.length === 0 ? (
              <div className="text-zinc-500">
                Type a command below and press Enter to execute.
                <br />
                Example: ls -la, cat /etc/os-release, env
              </div>
            ) : (
              terminalHistory.map((entry, index) => (
                <div key={index} className="mb-2">
                  {entry.type === "command" ? (
                    <div className="text-primary">
                      <span className="text-zinc-500">$ </span>
                      {entry.content}
                    </div>
                  ) : entry.type === "stdout" ? (
                    <pre className="text-zinc-300 whitespace-pre-wrap">{entry.content}</pre>
                  ) : entry.type === "stderr" ? (
                    <pre className="text-yellow-500 whitespace-pre-wrap">{entry.content}</pre>
                  ) : (
                    <div className="text-red-500">{entry.content}</div>
                  )}
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Command input */}
          <div className="flex gap-2 mt-4">
            <div className="flex-1 flex items-center gap-2 bg-zinc-950 rounded-lg px-3 border border-border">
              <span className="text-zinc-500 font-mono text-sm">$</span>
              <Input
                ref={terminalInputRef}
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    executeCommand();
                  }
                }}
                placeholder="Enter command..."
                className="border-0 bg-transparent font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={terminalLoading || !isRunning}
              />
            </div>
            <Button onClick={executeCommand} disabled={terminalLoading || !terminalCommand.trim() || !isRunning}>
              {terminalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
