"use client";

import { useEffect, useState } from "react";
import type { Overview } from "@/server/overview/types";

const POLL_MS = 15_000;

/** Refreshes the overview every 15 s while the tab is visible, and immediately when it becomes visible. */
export function useOverview(initial: Overview | null): Overview | null {
  const [overview, setOverview] = useState(initial);

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
    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return overview;
}
