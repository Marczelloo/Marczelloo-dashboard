"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Deploy, Service } from "@/types";
import { refreshRunningDeploysAction, checkDeployLogAction } from "@/app/actions/projects";
import { DeployLogsButton } from "./deploy-logs-button";
import { LiveDeployLogs } from "@/components/features/live-deploy-logs";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RecentDeploysClientProps {
  deploys: Deploy[];
  services: Service[];
}

function getStatusBadge(status: Deploy["status"]) {
  switch (status) {
    case "success":
      return (
        <Badge variant="secondary" className="bg-success/20 text-success border-success/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="secondary" className="bg-danger/20 text-danger border-danger/30">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getDuration(deploy: Deploy): string {
  if (!deploy.finished_at) {
    return formatDistanceToNow(new Date(deploy.started_at), { addSuffix: false, includeSeconds: true });
  }

  const start = new Date(deploy.started_at).getTime();
  const end = new Date(deploy.finished_at).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) return "<1s";
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
  return `${Math.round(durationMs / 3600000)}h`;
}

export function RecentDeploysClient({ deploys, services }: RecentDeploysClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isClearing, setIsClearing] = useState(false);

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const hasRunningDeploys = deploys.some((d) => d.status === "running");

  // Check running deploys
  const checkRunningDeploys = useCallback(async () => {
    // For each running deploy, check its log file
    const runningDeploys = deploys.filter((d) => d.status === "running" && d.logs_object_key);

    for (const deploy of runningDeploys) {
      if (!deploy.logs_object_key) continue;

      try {
        const result = await checkDeployLogAction(deploy.logs_object_key, deploy.id);
        if (result.success && result.data?.isComplete) {
          // Refresh the page to get updated data
          startTransition(() => {
            router.refresh();
          });
          break; // One refresh is enough
        }
      } catch (e) {
        console.error("Error checking deploy:", e);
      }
    }
  }, [deploys, router]);

  // Auto-refresh when there are running deploys
  useEffect(() => {
    if (!hasRunningDeploys) return;

    // Check immediately
    checkRunningDeploys();

    // Then check every 15 seconds
    const interval = setInterval(checkRunningDeploys, 15000);

    return () => clearInterval(interval);
  }, [hasRunningDeploys, checkRunningDeploys]);

  async function handleRefresh() {
    startTransition(async () => {
      const result = await refreshRunningDeploysAction();
      if (result.success) {
        router.refresh();
        if ((result.data?.updated ?? 0) > 0) {
          toast.success(`Updated ${result.data?.updated} deploy(s)`);
        }
      }
    });
  }

  async function handleClearAll() {
    setIsClearing(true);
    try {
      const response = await fetch("/api/deploys/clear", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        toast.success(`Cleared ${result.deleted} deployment(s)`);
        router.refresh();
      } else {
        toast.error("Failed to clear deployments", { description: result.error });
      }
    } catch {
      toast.error("Failed to clear deployments");
    } finally {
      setIsClearing(false);
    }
  }

  if (deploys.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Recent Deployments
          </CardTitle>
          <CardDescription>Latest deployment activity across all services</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No deployments yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Recent Deployments
          </CardTitle>
          <CardDescription>Latest deployment activity across all services</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isPending} title="Refresh deploy status">
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                title="Clear old deployments"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Deployment History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all completed deployments from history. Running deployments will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isClearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deploys.map((deploy) => {
            const service = serviceMap.get(deploy.service_id);
            const isRunning = deploy.status === "running";
            return (
              <div key={deploy.id} className="space-y-0">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(deploy.status)}
                    <div>
                      <p className="font-medium text-sm">{service?.name || "Unknown Service"}</p>
                      <p className="text-xs text-muted-foreground">
                        by {deploy.triggered_by} •{" "}
                        {formatDistanceToNow(new Date(deploy.started_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Check Status button for running deploys */}
                    {isRunning && deploy.logs_object_key && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const result = await checkDeployLogAction(deploy.logs_object_key!, deploy.id);
                          if (result.success) {
                            if (result.data?.isComplete) {
                              toast.success("Build completed!");
                              router.refresh();
                            } else {
                              toast.info("Build still in progress...");
                            }
                          }
                        }}
                        title="Check status"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <DeployLogsButton
                      logFile={deploy.logs_object_key || ""}
                      deployId={deploy.id}
                      serviceName={service?.name || "Unknown"}
                      hasLogFile={!!deploy.logs_object_key}
                    />
                    <div className="text-right">
                      <p className="text-sm font-mono text-muted-foreground">{getDuration(deploy)}</p>
                      {deploy.commit_sha && (
                        <p className="text-xs font-mono text-muted-foreground">{deploy.commit_sha.substring(0, 7)}</p>
                      )}
                    </div>
                  </div>
                </div>
                {/* Live logs for running deploys */}
                {isRunning && deploy.logs_object_key && (
                  <LiveDeployLogs logFile={deploy.logs_object_key} isRunning={isRunning} defaultExpanded={true} />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
