"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Rocket, RefreshCw, FileText, Loader2 } from "lucide-react";
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
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Recent Deploys
          </CardTitle>
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
