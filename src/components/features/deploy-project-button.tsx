"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Rocket,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Radio,
  GitBranch,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deployProjectAction, checkDeployLogAction, getManagedDeploymentConfigAction } from "@/app/actions/projects";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { JumpToLatest } from "./jump-to-latest";
import { useStickToBottom } from "./use-stick-to-bottom";

interface DeployProjectButtonProps {
  projectId: string;
  projectName: string;
  githubUrl?: string | null;
}

export function DeployProjectButton({ projectId, projectName, githubUrl }: DeployProjectButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showOutputDialog, setShowOutputDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<Array<{ name: string; isDefault: boolean }>>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [logFile, setLogFile] = useState<string | null>(null);
  const [deployId, setDeployId] = useState<string | undefined>(undefined);
  const [isChecking, setIsChecking] = useState(false);
  const [buildComplete, setBuildComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [managedDeployment, setManagedDeployment] = useState<{ repoPath: string; composeProject: string; branch: string } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const router = useRouter();
  const { ref: followRef, onScroll: onFollowScroll, paused: followPaused, jump: jumpToLatest } = useStickToBottom(output);

  // Parse GitHub URL to get owner/repo
  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return { owner: match[1], repo: match[2] };
    }
    return null;
  };

  // Fetch branches when dialog opens
  const fetchBranches = async () => {
    if (!githubUrl) return;
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) return;

    setLoadingBranches(true);
    try {
      const response = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}/branches`);
      if (response.ok) {
        const result = await response.json();
        // Get repo info for default branch
        const repoResponse = await fetch(`/api/github/repos/${parsed.owner}/${parsed.repo}`);
        let defaultBranch = "main";
        if (repoResponse.ok) {
          const repoData = await repoResponse.json();
          defaultBranch = repoData.data?.default_branch || "main";
        }

        const branchList = result.data.map((b: { name: string }) => ({
          name: b.name,
          isDefault: b.name === defaultBranch,
        }));
        setBranches(branchList);
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    } finally {
      setLoadingBranches(false);
    }
  };

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
        toast.warning("Stopped following the deploy", { description: "It is still running; the deploy history shows the result." });
      } else if (data.success) {
        toast.success(`${projectName} deployed`);
      } else {
        toast.error(`${projectName} deploy failed`, { description: "The previous release is still live; the log above shows why." });
      }
      router.refresh();

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

  async function handleClick() {
    // Show config dialog first
    setError(null);
    setOutput("");
    setLogFile(null);
    setDeployId(undefined);
    setBuildComplete(false);
    setSelectedBranch("");
    stopStreaming();
    const configResult = await getManagedDeploymentConfigAction(projectId);
    if (configResult.success && configResult.data) {
      setManagedDeployment({
        repoPath: configResult.data.repoPath,
        composeProject: configResult.data.composeProject,
        branch: configResult.data.branch,
      });
      setSelectedBranch(configResult.data.branch);
    } else {
      setManagedDeployment(null);
    }
    setShowConfigDialog(true);
    // Fetch branches if GitHub URL is available
    if (githubUrl) {
      fetchBranches();
    }
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

    const branchInfo = selectedBranch ? ` (branch: ${selectedBranch})` : "";
    toast.info(`Starting deployment for ${projectName}${branchInfo}...`);

    try {
      const result = await deployProjectAction(projectId, selectedBranch || undefined);

      if (result.success && result.data) {
        setOutput(result.data.output);

        // Store deploy ID for status updates
        if (result.data.deployId) {
          setDeployId(result.data.deployId);
        }

        const nextLogFile = result.data.logFile;
        if (nextLogFile) {
          setLogFile(nextLogFile);
          toast.success("Deploy queued", { description: "Following the agent's log live." });
          router.refresh();
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
      <Button variant="primary" onClick={handleClick} disabled={isDeploying}>
        {isDeploying ? <Loader2 className="animate-spin" /> : <Rocket strokeWidth={1.75} />}
        Deploy
      </Button>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deploy: {projectName}</DialogTitle>
            <DialogDescription>
              {managedDeployment
                ? `Managed deployment: ${managedDeployment.repoPath} · Compose ${managedDeployment.composeProject}`
                : "The project has no deploy configuration. Set it up from New project → From GitHub."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Branch Selector */}
            {githubUrl && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Branch
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="w-full justify-between" disabled={loadingBranches}>
                      {loadingBranches ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading branches...
                        </span>
                      ) : selectedBranch ? (
                        <span className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          {selectedBranch}
                        </span>
                      ) : (
                        <span className="text-fg-3">Use current branch (default)</span>
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-y-auto">
                    <DropdownMenuItem onClick={() => setSelectedBranch("")}>
                      <span className="text-fg-3">Use current branch (default)</span>
                    </DropdownMenuItem>
                    {branches.map((branch) => (
                      <DropdownMenuItem
                        key={branch.name}
                        onClick={() => setSelectedBranch(branch.name)}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          {branch.name}
                        </span>
                        {branch.isDefault && (
                          <span className="text-xs text-fg-3 bg-surface-raised px-1.5 py-0.5 rounded">
                            default
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-fg-3">
                  Select a branch to deploy. Leave empty to use the current branch on the Pi.
                </p>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeploy} disabled={!managedDeployment}>
              <Rocket strokeWidth={1.75} />
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
              {buildComplete && <CheckCircle2 className="h-5 w-5 text-ok" />}
              {isStreaming && (
                <span className="flex items-center gap-1 text-sm font-normal text-info">
                  <Radio className="h-4 w-4 animate-pulse" />
                  Live
                </span>
              )}
              {logFile && !buildComplete && !isStreaming && <Clock className="h-5 w-5 text-warn" />}
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
                  <Button variant="secondary" size="sm" onClick={stopStreaming}>
                    Stop Stream
                  </Button>
                )}
                {logFile && !isDeploying && !isStreaming && (
                  <Button variant="secondary" size="sm" onClick={handleCheckStatus} disabled={isChecking}>
                    {isChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Check Status
                  </Button>
                )}
                {logFile && !isStreaming && !buildComplete && (
                  <Button variant="secondary" size="sm" onClick={startStreaming}>
                    <Radio className="h-4 w-4 mr-2" />
                    Stream Logs
                  </Button>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={followRef} onScroll={onFollowScroll} className="min-h-0 flex-1 overflow-auto rounded-md border border-line bg-canvas p-4 font-mono text-xs whitespace-pre-wrap text-fg-2">
            {isDeploying ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-fg-3" />
                <span className="ml-2 text-fg-3">Starting deployment...</span>
              </div>
            ) : error ? (
              <div className="text-err">{error}</div>
            ) : (
              output || "No output"
            )}
          </div>
          <JumpToLatest visible={followPaused} onClick={jumpToLatest} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
