"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { checkDeployLogAction } from "@/app/actions/projects";

interface DeployLogsButtonProps {
  logFile: string;
  deployId: string;
  serviceName: string;
}

export function DeployLogsButton({ logFile, deployId, serviceName }: DeployLogsButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
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
        className="h-7 px-2 text-muted-foreground hover:text-foreground"
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
          <div className="flex-1 min-h-0 overflow-auto bg-secondary/50 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading logs...</span>
              </div>
            ) : error ? (
              <div className="text-danger">{error}</div>
            ) : logs ? (
              logs
            ) : (
              <span className="text-muted-foreground">No logs available</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
