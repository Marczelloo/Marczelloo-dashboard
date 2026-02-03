"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Rocket, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { deployProjectAction } from "@/app/actions/projects";

interface DeployProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function DeployProjectButton({ projectId, projectName }: DeployProjectButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function handleDeploy() {
    setIsDeploying(true);
    setError(null);
    setOutput("");
    setShowDialog(true);

    try {
      const result = await deployProjectAction(projectId);

      if (result.success && result.data) {
        setOutput(result.data.output);
      } else {
        setError(result.error || "Deployment failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <>
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleDeploy}
        disabled={isDeploying}
        className="bg-primary hover:bg-primary/90"
      >
        {isDeploying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        Deploy Project
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Deploy: {projectName}</DialogTitle>
            <DialogDescription>
              {isDeploying ? "Deploying..." : error ? "Deployment failed" : "Deployment complete"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-secondary/50 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap">
            {isDeploying ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Running git pull and docker compose...</span>
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
