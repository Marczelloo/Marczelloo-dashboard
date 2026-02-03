"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Loader2, FolderOpen, RefreshCw, CheckCircle2, Clock, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deployProjectAction, checkDeployLogAction } from "@/app/actions/projects";
import { toast } from "sonner";

interface DeployProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function DeployProjectButton({ projectId, projectName }: DeployProjectButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showOutputDialog, setShowOutputDialog] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [logFile, setLogFile] = useState<string | null>(null);
  const [deployId, setDeployId] = useState<string | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);
  const [buildComplete, setBuildComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Start streaming when log file is available
  useEffect(() => {
    if (logFile && !buildComplete && !eventSourceRef.current) {
      startStreaming();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFile, buildComplete]);

  function startStreaming() {
    if (!logFile || eventSourceRef.current) return;

    setIsStreaming(true);
    const es = new EventSource(`/api/deploy/logs/stream?logFile=${encodeURIComponent(logFile)}`);
    eventSourceRef.current = es;

    es.addEventListener("log", (event) => {
      const data = JSON.parse(event.data);
      setOutput((prev) => prev + data.content);
    });

    es.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      if (!data.running) {
        setBuildComplete(true);
      }
    });

    es.addEventListener("complete", (event) => {
      const data = JSON.parse(event.data);
      setBuildComplete(true);
      setIsStreaming(false);
      es.close();
      eventSourceRef.current = null;

      if (data.timedOut) {
        toast.warning("Build monitoring timed out", { description: "Check container status manually" });
      } else {
        toast.success(`${projectName} build completed!`);
      }

      // Update deploy record if we have an ID
      if (deployId) {
        checkDeployLogAction(logFile!, deployId);
      }
    });

    es.addEventListener("error", () => {
      setIsStreaming(false);
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
      eventSourceRef.current = null;
    };
  }

  function stopStreaming() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    }
  }

  function handleClick() {
    // Show config dialog first
    setError(null);
    setOutput("");
    setLogFile(null);
    setDeployId(undefined);
    setBuildComplete(false);
    stopStreaming();
    setShowConfigDialog(true);
  }

  async function handleDeploy() {
    setIsDeploying(true);
    setError(null);
    setOutput("");
    setLogFile(null);
    setDeployId(undefined);
    setBuildComplete(false);
    setShowConfigDialog(false);
    setShowOutputDialog(true);

    toast.info(`Starting deployment for ${projectName}...`);

    try {
      // Pass custom path if provided
      const pathToUse = customPath.trim() || undefined;
      console.log("[Deploy] Starting deploy with path:", pathToUse || "(auto-detect)");

      const result = await deployProjectAction(projectId, pathToUse);

      if (result.success && result.data) {
        let outputText = result.data.output;
        // If detected path was returned, show it
        if (result.data.detectedPath && !customPath) {
          outputText = `Detected path: ${result.data.detectedPath}\n\n${outputText}`;
        }
        setOutput(outputText);

        // Store deploy ID for status updates
        if (result.data.deployId) {
          setDeployId(result.data.deployId);
        }

        // Extract log file path from output
        const logMatch = outputText.match(/Log file: (\/tmp\/deploy-[^\s]+\.log)/);
        if (logMatch) {
          setLogFile(logMatch[1]);
          toast.success("Build started in background", {
            description: "Use Check Status to monitor progress",
          });
        }
      } else {
        setError(result.error || "Deployment failed");
        toast.error("Deployment failed", {
          description: result.error || "Unknown error",
        });
      }
    } catch (err) {
      console.error("[Deploy] Error:", err);
      const errorMsg = err instanceof Error ? err.message : "Deployment failed";
      setError(errorMsg);
      toast.error("Deployment failed", { description: errorMsg });
    } finally {
      setIsDeploying(false);
    }
  }

  async function handleCheckStatus() {
    if (!logFile) return;

    setIsChecking(true);
    try {
      const result = await checkDeployLogAction(logFile, deployId);
      if (result.success && result.data) {
        setOutput((prev) => {
          // Keep the header info, replace log content
          const headerEnd = prev.indexOf("=== Docker Compose ===");
          const header = headerEnd > 0 ? prev.substring(0, headerEnd) : "";
          return `${header}=== Docker Compose Build Log ===\n${result.data!.log}\n\n${result.data!.isComplete ? "✅ Build process completed" : "⏳ Build still running..."}`;
        });

        // Only show toast if state changed to complete
        if (result.data.isComplete && !buildComplete) {
          toast.success(`${projectName} build completed!`, {
            description: "Docker containers are now running",
          });
        }
        setBuildComplete(result.data.isComplete);
      } else {
        setError(result.error || "Failed to check status");
        toast.error("Failed to check status", { description: result.error });
      }
    } catch (err) {
      console.error("[Deploy] Check status error:", err);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={handleClick}
        disabled={isDeploying}
        className="bg-primary hover:bg-primary/90"
      >
        {isDeploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        Deploy Project
      </Button>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deploy: {projectName}</DialogTitle>
            <DialogDescription>
              Configure deployment settings. Leave path empty to auto-detect from service repo_path.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="repoPath" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Repository Path
              </Label>
              <Input
                id="repoPath"
                placeholder="/home/Marczelloo_pi/projects/my-project"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The path to the project directory on the Raspberry Pi. Must contain docker-compose.yml.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeploy} className="bg-primary hover:bg-primary/90">
              <Rocket className="h-4 w-4 mr-2" />
              Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Output Dialog */}
      <Dialog
        open={showOutputDialog}
        onOpenChange={(open) => {
          if (!open) stopStreaming();
          setShowOutputDialog(open);
        }}
      >
        <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Deploy: {projectName}
              {buildComplete && <CheckCircle2 className="h-5 w-5 text-success" />}
              {isStreaming && (
                <span className="flex items-center gap-1 text-sm font-normal text-primary">
                  <Radio className="h-4 w-4 animate-pulse" />
                  Live
                </span>
              )}
              {logFile && !buildComplete && !isStreaming && <Clock className="h-5 w-5 text-warning" />}
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>
                {isDeploying
                  ? "Starting deployment..."
                  : error
                    ? "Deployment failed"
                    : isStreaming
                      ? "Streaming logs..."
                      : logFile
                        ? buildComplete
                          ? "Build completed"
                          : "Build running in background"
                        : "Deployment started"}
              </span>
              <div className="flex gap-2">
                {isStreaming && (
                  <Button variant="outline" size="sm" onClick={stopStreaming}>
                    Stop Stream
                  </Button>
                )}
                {logFile && !isDeploying && !isStreaming && (
                  <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={isChecking}>
                    {isChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Check Status
                  </Button>
                )}
                {logFile && !isStreaming && !buildComplete && (
                  <Button variant="outline" size="sm" onClick={startStreaming}>
                    <Radio className="h-4 w-4 mr-2" />
                    Stream Logs
                  </Button>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-secondary/50 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap">
            {isDeploying ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Starting deployment...</span>
              </div>
            ) : error ? (
              <div className="text-danger">{error}</div>
            ) : (
              output || "No output"
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
