"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Loader2, FolderOpen, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deployProjectAction, checkDeployLogAction } from "@/app/actions/projects";

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
  const [isChecking, setIsChecking] = useState(false);
  const [buildComplete, setBuildComplete] = useState(false);

  function handleClick() {
    // Show config dialog first
    setError(null);
    setOutput("");
    setLogFile(null);
    setBuildComplete(false);
    setShowConfigDialog(true);
  }

  async function handleDeploy() {
    setIsDeploying(true);
    setError(null);
    setOutput("");
    setLogFile(null);
    setBuildComplete(false);
    setShowConfigDialog(false);
    setShowOutputDialog(true);

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
        
        // Extract log file path from output
        const logMatch = outputText.match(/Log file: (\/tmp\/deploy-[^\s]+\.log)/);
        if (logMatch) {
          setLogFile(logMatch[1]);
        }
      } else {
        setError(result.error || "Deployment failed");
      }
    } catch (err) {
      console.error("[Deploy] Error:", err);
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  }

  async function handleCheckStatus() {
    if (!logFile) return;
    
    setIsChecking(true);
    try {
      const result = await checkDeployLogAction(logFile);
      if (result.success && result.data) {
        setOutput(prev => {
          // Keep the header info, replace log content
          const headerEnd = prev.indexOf("=== Docker Compose ===");
          const header = headerEnd > 0 ? prev.substring(0, headerEnd) : "";
          return `${header}=== Docker Compose Build Log ===\n${result.data!.log}\n\n${result.data!.isComplete ? "✅ Build process completed" : "⏳ Build still running..."}`;
        });
        setBuildComplete(result.data.isComplete);
      } else {
        setError(result.error || "Failed to check status");
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
      <Dialog open={showOutputDialog} onOpenChange={setShowOutputDialog}>
        <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Deploy: {projectName}
              {buildComplete && <CheckCircle2 className="h-5 w-5 text-success" />}
              {logFile && !buildComplete && <Clock className="h-5 w-5 text-warning" />}
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>
                {isDeploying ? "Starting deployment..." : error ? "Deployment failed" : logFile ? "Build running in background" : "Deployment started"}
              </span>
              {logFile && !isDeploying && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckStatus}
                  disabled={isChecking}
                >
                  {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Check Status
                </Button>
              )}
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
