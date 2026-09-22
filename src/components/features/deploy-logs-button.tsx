"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { checkDeployLogAction } from "@/app/actions/projects";
import { JumpToLatest } from "./jump-to-latest";
import { useStickToBottom } from "./use-stick-to-bottom";

interface DeployLogsButtonProps {
  logFile: string;
  deployId: string;
  serviceName: string;
  hasLogFile?: boolean;
}

export function DeployLogsButton({ logFile, deployId, serviceName, hasLogFile = true }: DeployLogsButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { ref: followRef, onScroll: onFollowScroll, paused: followPaused, jump: jumpToLatest } = useStickToBottom(logs);

  async function handleOpen() {
    if (!hasLogFile) {
      setOpen(true);
      setError("No log file available for this deployment");
      return;
    }

    setOpen(true);
    setLoading(true);
    setError(null);
    setLogs("");

    try {
      const result = await checkDeployLogAction(logFile, deployId);
      if (result.success && result.data) {
        setLogs(result.data.log);
      } else {
        setError(result.error || "Failed to load logs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="h-7 px-2 text-fg-3 hover:text-fg"
        title="View deploy logs"
      >
        <FileText className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Deploy Logs: {serviceName}
            </DialogTitle>
            <DialogDescription>Log file: {logFile}</DialogDescription>
          </DialogHeader>
          <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={followRef} onScroll={onFollowScroll} className="min-h-0 flex-1 overflow-auto rounded-md border border-line bg-canvas p-4 font-mono text-xs whitespace-pre-wrap text-fg-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-fg-3" />
                <span className="ml-2 text-fg-3">Loading logs...</span>
              </div>
            ) : error ? (
              <div className="text-err">{error}</div>
            ) : logs ? (
              logs
            ) : (
              <span className="text-fg-3">No logs available</span>
            )}
          </div>
          <JumpToLatest visible={followPaused} onClick={jumpToLatest} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
