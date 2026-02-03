"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { Plus, RefreshCw, Rocket, Loader2, Power, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function QuickActions() {
  const router = useRouter();
  const [deploying, setDeploying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [deployResult, setDeployResult] = useState<{ open: boolean; success: boolean; message: string }>({
    open: false,
    success: false,
    message: "",
  });

  async function handleDeployAll() {
    setDeploying(true);
    toast.info("Starting deployment for all services...");

    try {
      const response = await fetch("/api/deploy/all", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        toast.success(`Deployed ${result.deployed} service(s)`, {
          description: result.failed > 0 ? `${result.failed} failed` : undefined,
        });
      } else {
        toast.error("Deploy failed", { description: result.error });
      }

      setDeployResult({
        open: true,
        success: result.success,
        message: result.success
          ? `Successfully triggered deploy for ${result.deployed} service(s)${result.failed > 0 ? `, ${result.failed} failed` : ""}`
          : result.error || "Deploy failed",
      });
    } catch {
      toast.error("Failed to trigger deployments");
      setDeployResult({
        open: true,
        success: false,
        message: "Failed to trigger deployments",
      });
    } finally {
      setDeploying(false);
    }
  }

  async function handleRunChecks() {
    setChecking(true);
    toast.info("Running health checks...");

    try {
      const response = await fetch("/api/monitoring/check", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        toast.success("Health checks completed", {
          description: `${result.checked || 0} services checked`,
        });
        router.refresh();
      } else {
        toast.error("Checks failed", { description: result.error });
      }
    } catch {
      toast.error("Failed to run checks");
    } finally {
      setChecking(false);
    }
  }

  async function handleRestartPi() {
    setShowRestartConfirm(false);
    setRestarting(true);
    toast.info("Initiating Pi restart...");

    try {
      const response = await fetch("/api/pi/restart", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        toast.success("Pi is restarting", {
          description: "Dashboard will be unavailable for ~1-2 minutes",
        });
      } else {
        toast.error("Restart failed", { description: result.error });
      }
    } catch {
      toast.error("Failed to restart Pi");
    } finally {
      setRestarting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/projects/new" className="block">
            <Button variant="default" className="w-full justify-start gap-3 h-auto py-3">
              <Plus className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">New Project</div>
                <div className="text-xs opacity-70">Create a new project</div>
              </div>
            </Button>
          </Link>

          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleDeployAll}
            disabled={deploying}
          >
            {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            <div className="text-left">
              <div className="font-medium">Deploy All</div>
              <div className="text-xs opacity-70">Update all services</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleRunChecks}
            disabled={checking}
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <div className="text-left">
              <div className="font-medium">Run Checks</div>
              <div className="text-xs opacity-70">Check all services</div>
            </div>
          </Button>

          <Link href="/containers" className="block">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <div className="text-left">
                <div className="font-medium">Containers</div>
                <div className="text-xs opacity-70">Manage Docker containers</div>
              </div>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3 border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowRestartConfirm(true)}
            disabled={restarting}
          >
            {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            <div className="text-left">
              <div className="font-medium">Restart Pi</div>
              <div className="text-xs opacity-70">Reboot Raspberry Pi</div>
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* Restart Confirmation Dialog */}
      <Dialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Restart Raspberry Pi?
            </DialogTitle>
            <DialogDescription>
              This will restart the Pi and all services. The dashboard will be unavailable for 1-2 minutes. All Docker
              containers will restart automatically after boot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRestartConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRestartPi}>
              Restart Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deployResult.open} onOpenChange={(open) => setDeployResult((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deployResult.success ? "Deploy Triggered" : "Deploy Failed"}</DialogTitle>
            <DialogDescription>{deployResult.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeployResult((prev) => ({ ...prev, open: false }))}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
