"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentActivity } from "@/components/layout/agent-activity";
import type { HostSample, HostSummary } from "@/lib/host";

export type { HostSample };

const POLL_MS = 15_000;
const HISTORY = 40;

/**
 * Keeps the host reading fresh while the tab is visible and remembers the samples
 * seen in this session — the Pi keeps no history of its own.
 */
export function useHost(initial: HostSummary) {
  const [summary, setSummary] = useState(initial);
  const [history, setHistory] = useState<HostSample[]>(initial.history ?? []);
  const [refreshing, setRefreshing] = useState(false);
  const lastAt = useRef<string | null>(null);
  const { generation } = useAgentActivity();

  const record = useCallback((next: HostSummary) => {
    setSummary(next);
    if (!next.host || lastAt.current === next.generatedAt) return;
    lastAt.current = next.generatedAt;
    const host = next.host;
    setHistory((current) =>
      [
        ...current,
        {
          at: Date.parse(next.generatedAt),
          load: host.loadavg[0] / Math.max(1, host.cores),
          memory: (host.memory.totalBytes - host.memory.availableBytes) / Math.max(1, host.memory.totalBytes),
          temperature: host.temperatureC,
        },
      ].slice(-HISTORY)
    );
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/host", { cache: "no-store" });
      const result = (await response.json()) as { success: boolean; data?: HostSummary };
      if (result.success && result.data) record(result.data);
    } catch {
      // Keep showing the last good reading.
    } finally {
      setRefreshing(false);
    }
  }, [record]);

  useEffect(() => {
    record(initial);
    // Seeding the history from the first render only; later samples arrive through refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Containers change when a job starts or ends; show it without waiting for the next tick.
  useEffect(() => {
    if (generation > 0) void refresh();
  }, [generation, refresh]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  return { summary, history, refreshing, refresh };
}
