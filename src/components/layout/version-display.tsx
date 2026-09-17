"use client";

import { useEffect, useState } from "react";
import { GitCommit } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

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

  if (!loaded || !version) return <div className="h-8" />;

  return (
    <div className="mt-1 flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-fg-4" title={version.subject ?? undefined}>
      <GitCommit className="size-3.5 shrink-0" strokeWidth={1.75} />
      <code className="text-fg-3">{version.shortCommit}</code>
      <span className="truncate">· {formatRelativeTime(version.deployedAt)}</span>
    </div>
  );
}
