"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

interface DeploymentStatus {
  status: "idle" | "deploying" | "success" | "failed";
  message?: string;
  commit?: string;
  timestamp?: string;
  canReload?: boolean;
}

export function DeploymentStatusBanner() {
  const [status, setStatus] = useState<DeploymentStatus>({ status: "idle" });
  const [visible, setVisible] = useState(false);
  const [autoDismissed, setAutoDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      try {
        const response = await fetch("/api/deployment/status");
        if (response.ok) {
          const data = await response.json();
          if (mounted) {
            console.log("[DeploymentBanner] Status:", data.status, data.message);
            setStatus(data);

            // If status is success, immediately clear it and show banner briefly
            // This prevents the banner from reappearing on every page load
            if (data.status === "success") {
              setVisible(true);
              // Clear the status file immediately so it doesn't reappear
              console.log("[DeploymentBanner] Clearing success status...");
              fetch("/api/deployment/status", { method: "DELETE" })
                .then((res) => console.log("[DeploymentBanner] Clear response:", res.status))
                .catch((e) => console.error("[DeploymentBanner] Clear failed:", e));
              // Auto-dismiss after 8 seconds
              const timer = setTimeout(() => {
                if (mounted) setVisible(false);
              }, 8000);
              return () => clearTimeout(timer);
            } else if (data.status === "deploying") {
              setVisible(true);
            } else if (data.status === "failed") {
              setVisible(true);
              // Auto-dismiss failed status after 10 seconds
              const timer = setTimeout(() => {
                if (mounted) setVisible(false);
              }, 10000);
              return () => clearTimeout(timer);
            } else {
              setVisible(false);
            }
          }
        }
      } catch (e) {
        console.error("[DeploymentBanner] Error checking status:", e);
      }
    }

    // Check immediately
    checkStatus();

    // Poll every 3 seconds when deploying
    const interval = setInterval(checkStatus, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!visible) return null;

  const getStatusColor = () => {
    switch (status.status) {
      case "deploying":
        return "bg-blue-500/10 border-blue-500/20 text-blue-500";
      case "success":
        return "bg-green-500/10 border-green-500/20 text-green-500";
      case "failed":
        return "bg-red-500/10 border-red-500/20 text-red-500";
      default:
        return "bg-muted/10 border-border text-muted-foreground";
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case "deploying":
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
      case "success":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleDismiss = async () => {
    setVisible(false);
    // Clear the status file so banner doesn't reappear on page reload
    try {
      await fetch("/api/deployment/status", { method: "DELETE" });
    } catch (e) {
      console.error("Failed to clear status:", e);
    }
  };

  return (
    <div className={`mx-3 mt-2 rounded border px-3 py-2 ${getStatusColor()}`}>
      <div className="flex items-start gap-2">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase">
            {status.status === "deploying" && "Self-Deploy in Progress"}
            {status.status === "success" && "Self-Deploy Complete"}
            {status.status === "failed" && "Self-Deploy Failed"}
          </p>
          {status.message && (
            <p className="text-[10px] opacity-80 truncate mt-0.5">{status.message}</p>
          )}
          {status.commit && (
            <p className="text-[9px] opacity-60 font-mono mt-0.5">{status.commit}</p>
          )}
        </div>
        {status.canReload && status.status === "success" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] h-auto py-1"
            onClick={handleReload}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reload
          </Button>
        )}
        {status.status !== "deploying" && (
          <button
            onClick={handleDismiss}
            className="text-[10px] opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
