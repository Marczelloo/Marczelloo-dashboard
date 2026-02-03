"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { Plus, RefreshCw, Rocket, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function QuickActions() {
  const router = useRouter();
  const [deploying, setDeploying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [deployResult, setDeployResult] = useState<{ open: boolean; success: boolean; message: string }>({
    open: false,
    success: false,
    message: "",
  });

  async function handleDeployAll() {
    setDeploying(true);
    try {
      const response = await fetch("/api/deploy/all", { method: "POST" });
      const result = await response.json();

      setDeployResult({
        open: true,
        success: result.success,
        message: result.success
          ? `Successfully triggered deploy for ${result.deployed} service(s)`
          : result.error || "Deploy failed",
      });
    } catch {
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
    try {
      const response = await fetch("/api/monitoring/check", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        router.refresh();
      }
    } catch {
      // Silently fail
    } finally {
      setChecking(false);
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
        </CardContent>
      </Card>

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
