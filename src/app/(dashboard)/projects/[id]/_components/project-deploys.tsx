"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Rocket, RefreshCw, FileText, Loader2, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { checkDeployLogAction } from "@/app/actions/projects";
import { toast } from "sonner";
import type { Deploy, Service } from "@/types";

interface ProjectDeploysClientProps {
  deploys: Deploy[];
  services: Service[];
}

const statusColors: Record<string, "secondary" | "warning" | "success" | "danger"> = {
  pending: "secondary",
  running: "warning",
  success: "success",
  failed: "danger",
  cancelled: "secondary",
};

export function ProjectDeploysClient({ deploys, services }: ProjectDeploysClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isClearing, setIsClearing] = useState(false);
  const [logDialog, setLogDialog] = useState<{
    open: boolean;
    log: string;
    serviceName: string;
    isLoading: boolean;
  }>({
    open: false,
    log: "",
    serviceName: "",
    isLoading: false,
  });

  const serviceMap = new Map(services.map((s) => [s.id, s]));

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

  async function handleCheckStatus(deploy: Deploy) {
    if (!deploy.logs_object_key) {
      toast.error("No log file available");
      return;
    }

    const result = await checkDeployLogAction(deploy.logs_object_key, deploy.id);
    if (result.success) {
      if (result.data?.isComplete) {
        toast.success("Build completed!");
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.info("Build still in progress...");
      }
    } else {
      toast.error(result.error || "Failed to check status");
    }
  }

  async function handleViewLogs(deploy: Deploy) {
    if (!deploy.logs_object_key) {
      toast.error("No log file available");
      return;
    }

    const service = serviceMap.get(deploy.service_id);

    setLogDialog({
      open: true,
      log: "",
      serviceName: service?.name || "Unknown Service",
      isLoading: true,
    });

    const result = await checkDeployLogAction(deploy.logs_object_key, deploy.id);
    if (result.success && result.data) {
      setLogDialog((prev) => ({
        ...prev,
        log: result.data!.log,
        isLoading: false,
      }));

      // Refresh if complete
      if (result.data.isComplete && deploy.status === "running") {
        startTransition(() => {
          router.refresh();
        });
      }
    } else {
      setLogDialog((prev) => ({
        ...prev,
        log: result.error || "Failed to load logs",
        isLoading: false,
      }));
    }
  }

  if (deploys.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Recent Deploys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No deploys yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Recent Deploys
          </CardTitle>
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
                  This will remove all completed deployments. Running deployments will not be affected.
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
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deploys.map((deploy) => {
              const service = serviceMap.get(deploy.service_id);
              return (
                <div key={deploy.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={statusColors[deploy.status]}>{deploy.status}</Badge>
                    <div>
                      <p className="text-sm font-medium">{service?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(deploy.started_at)}
                        {deploy.commit_sha && ` • ${deploy.commit_sha.slice(0, 7)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Check Status button for running deploys */}
                    {deploy.status === "running" && deploy.logs_object_key && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckStatus(deploy)}
                        disabled={isPending}
                        title="Check status"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                      </Button>
                    )}

                    {/* View Logs button */}
                    {deploy.logs_object_key && (
                      <Button variant="ghost" size="sm" onClick={() => handleViewLogs(deploy)} title="View logs">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <span className="text-xs text-muted-foreground">{deploy.triggered_by}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <Dialog open={logDialog.open} onOpenChange={(open) => setLogDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Deploy Logs - {logDialog.serviceName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 bg-zinc-950 rounded-lg p-4 overflow-auto max-h-[60vh]">
            {logDialog.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                {logDialog.log || "No logs available"}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
