"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVE_POLL_MS, IDLE_POLL_MS, anyActive, shouldRefresh, type AgentActivity } from "@/lib/agent-activity";

interface AgentActivityValue {
  activity: AgentActivity | null;
  /** Grows each time a job starts or finishes; client-fetched views refetch on it. */
  generation: number;
}

const AgentActivityContext = createContext<AgentActivityValue>({ activity: null, generation: 0 });

/**
 * Watches the agent and refreshes the page when a deploy, rollback or env apply
 * starts or ends, so statuses change without a manual reload. Polls every 3 s
 * while a job runs and every 10 s otherwise; only the agent is asked, never AtlasHub.
 */
export function AgentActivityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [value, setValue] = useState<AgentActivityValue>({ activity: null, generation: 0 });
  const previous = useRef<AgentActivity | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/agent/activity", { cache: "no-store" });
          if (response.ok && !cancelled) {
            const next = (await response.json()) as AgentActivity;
            const changed = shouldRefresh(previous.current, next);
            previous.current = next;
            setValue((current) => ({ activity: next, generation: current.generation + (changed ? 1 : 0) }));
            if (changed) router.refresh();
          }
        } catch {
          // The agent restarts now and then; the next poll catches up.
        }
      }
      if (!cancelled) timer = setTimeout(poll, anyActive(previous.current) ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void poll();
    };

    void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return <AgentActivityContext.Provider value={value}>{children}</AgentActivityContext.Provider>;
}

export function useAgentActivity(): AgentActivityValue {
  return useContext(AgentActivityContext);
}
