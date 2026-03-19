"use client";

import { useEffect, useState } from "react";
import { GitCommit, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeploymentStatusBanner } from "./deployment-status-banner";

interface VersionInfo {
  shortCommit: string;
  author: string;
  relativeDate: string;
  subject: string;
  branch: string;
  hasUncommittedChanges: boolean;
}

export function VersionDisplay() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadVersion() {
      try {
        const response = await fetch("/api/version");
        const result = await response.json();

        if (mounted && result.success) {
          setVersion(result.version);
          setError(null);
        } else if (mounted) {
          setError("Failed to load version");
        }
      } catch (err) {
        if (mounted) {
          console.error("[VersionDisplay] Error:", err);
          setError("Connection error");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadVersion();

    // Refresh version every 5 minutes to check for updates
    const interval = setInterval(loadVersion, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <div className="h-3 w-3 animate-pulse rounded bg-muted" />
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  if (error || !version) {
    return null;
  }

  return (
    <div className="space-y-1">
      <DeploymentStatusBanner />

      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <GitCommit className="h-3 w-3 text-muted-foreground" />
        <code className="flex-1 truncate text-muted-foreground">{version.shortCommit}</code>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[10px] text-muted-foreground truncate" title={version.subject}>
          {version.subject}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-emerald-500/80 font-medium">
            ✨ Self-deploy is working!
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            {version.branch} • {version.relativeDate}
          </span>
          {version.hasUncommittedChanges && (
            <span className="flex items-center gap-1 text-[10px] text-warning">
              <AlertCircle className="h-2.5 w-2.5" />
              Uncommitted
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
