"use client";

import { useEffect, useState } from "react";
import { useAgentActivity } from "@/components/layout/agent-activity";
import type { Overview } from "@/server/overview/types";

const POLL_MS = 15_000;

/**
 * Refreshes the overview every 15 s while the tab is visible, immediately when it
 * becomes visible, and as soon as the agent starts or finishes a job.
 */
export function useOverview(initial: Overview | null): Overview | null {
  const [overview, setOverview] = useState(initial);
  const { generation } = useAgentActivity();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/overview", { cache: "no-store" });
        const result = (await response.json()) as { success: boolean; data?: Overview };
        if (!cancelled && result.success && result.data) setOverview(result.data);
      } catch {
        // Keep showing the last good overview.
      }
    };
    // A job just started or finished: read it now rather than on the next tick.
    if (generation > 0) void refresh();
    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [generation]);

  return overview;
}
