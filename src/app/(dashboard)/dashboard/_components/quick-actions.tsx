"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export function QuickActions() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

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

  return (
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
  );
}
