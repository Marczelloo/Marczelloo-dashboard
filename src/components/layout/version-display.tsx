"use client";

import { useEffect, useState } from "react";
import { GitCommit } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { DeploymentStatusBanner } from "./deployment-status-banner";

interface VersionInfo {
  commit: string;
  shortCommit: string;
  author: string | null;
  committedAt: string | null;
  subject: string | null;
  branch: string | null;
  deployedAt: string;
}

export function VersionDisplay() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/version", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { success: boolean; version?: VersionInfo }) => {
        if (mounted && result.success && result.version) setVersion(result.version);
      })
      .catch(() => undefined)
      .finally(() => mounted && setLoaded(true));
    return () => {
      mounted = false;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <div className="h-3 w-3 animate-pulse rounded bg-muted" />
        <span className="animate-pulse">Wczytywanie…</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <DeploymentStatusBanner loadedCommit={version?.commit ?? null} />
      {version && (
        <>
          <div className="flex items-center gap-2 px-3 py-2 text-xs">
            <GitCommit className="h-3 w-3 text-muted-foreground" />
            <code className="flex-1 truncate text-muted-foreground">{version.shortCommit}</code>
          </div>
          <div className="px-3 pb-2">
            {version.subject && (
              <p className="truncate text-[10px] text-muted-foreground" title={version.subject}>
                {version.subject}
              </p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              {version.branch ?? "—"} • wdrożono {formatRelativeTime(version.deployedAt)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
