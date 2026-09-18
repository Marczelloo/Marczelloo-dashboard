"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Container, Loader2, Play, RotateCcw, ScrollText, Search, Square } from "lucide-react";
import { toast } from "sonner";
import { StatusDot } from "@/components/status-dot";
import { LogConsole } from "@/components/features/log-console";
import { Button, Chip, Dialog, DialogContent, DialogHeader, DialogTitle, EmptyState, Input, Panel, SegmentedControl, Skeleton } from "@/components/ui";

interface HostContainer {
  id: string;
  name: string;
  status: string;
  state: string;
  image: string;
  ports: string[];
  endpointId: number;
  composeProject: string | null;
  composeService: string | null;
}

type Filter = "all" | "running" | "stopped";

const isRunning = (container: HostContainer) => container.state === "running";

/** Every container on the Pi, grouped by the compose project it belongs to. */
export function ContainersTab() {
  const [containers, setContainers] = useState<HostContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<HostContainer | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/containers/list", { cache: "no-store" });
      const result = (await response.json()) as { success: boolean; data?: HostContainer[]; error?: string };
      if (!result.success) throw new Error(result.error ?? "Docker did not answer");
      setContainers(result.data ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not list the containers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(container: HostContainer, action: "start" | "stop" | "restart") {
    setPending(`${container.id}:${action}`);
    try {
      const response = await fetch("/api/containers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId: container.endpointId, containerId: container.id, action }),
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error ?? `Could not ${action} ${container.name}`);
        return;
      }
      toast.success(`${container.name}: ${action} requested`);
      setTimeout(() => void load(), 1200);
    } catch {
      toast.error(`Could not ${action} ${container.name}`);
    } finally {
      setPending(null);
    }
  }

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = containers.filter((container) => {
      if (filter === "running" && !isRunning(container)) return false;
      if (filter === "stopped" && isRunning(container)) return false;
      return !needle || `${container.name} ${container.image} ${container.composeProject ?? ""}`.toLowerCase().includes(needle);
    });
    const byProject = new Map<string, HostContainer[]>();
    for (const container of visible) {
      const key = container.composeProject ?? "Standalone";
      byProject.set(key, [...(byProject.get(key) ?? []), container]);
    }
    return [...byProject.entries()].sort(([a], [b]) => (a === "Standalone" ? 1 : b === "Standalone" ? -1 : a.localeCompare(b)));
  }, [containers, filter, query]);

  if (loading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-[320px] rounded-md" />
        <Skeleton className="h-[260px] rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Panel>
        <EmptyState icon={Container} title="Docker is out of reach" description={error} action={<Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Filter>
          aria-label="Filter containers"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: containers.length },
            { value: "running", label: "Running", count: containers.filter(isRunning).length },
            { value: "stopped", label: "Stopped", count: containers.filter((container) => !isRunning(container)).length },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <Search className="size-4 text-fg-4" strokeWidth={1.75} />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search containers" className="h-8 w-[200px]" aria-label="Search containers" />
        </div>
      </div>

      {groups.length === 0 ? (
        <Panel>
          <EmptyState icon={Container} title="Nothing matches" description="Loosen the filter to see the rest of the containers." />
        </Panel>
      ) : (
        groups.map(([project, rows]) => (
          <Panel key={project}>
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-2.5">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                <Container className="size-4 text-fg-3" strokeWidth={1.75} />
                {project}
              </h2>
              <span className="font-mono text-[11px] text-fg-3">{rows.length}</span>
            </div>
            {rows.map((container) => (
              <div key={container.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
                <StatusDot status={isRunning(container) ? "ok" : "err"} />
                <Link href={`/containers/${container.endpointId}/${container.id}`} className="min-w-0 truncate text-[13px] font-medium hover:underline">
                  {container.name}
                </Link>
                <span className="min-w-0 truncate font-mono text-[11.5px] text-fg-4">{container.image}</span>
                <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  {container.ports.slice(0, 3).map((port) => (
                    <Chip key={port} mono>
                      {port}
                    </Chip>
                  ))}
                  <span className="w-[92px] truncate text-right text-[11.5px] text-fg-3">{container.status}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Logs of ${container.name}`} onClick={() => setLogsFor(container)}>
                    <ScrollText strokeWidth={1.75} />
                  </Button>
                  {isRunning(container) ? (
                    <>
                      <Button variant="secondary" size="icon-sm" aria-label={`Restart ${container.name}`} onClick={() => void act(container, "restart")} disabled={pending !== null}>
                        {pending === `${container.id}:restart` ? <Loader2 className="animate-spin" /> : <RotateCcw strokeWidth={1.75} />}
                      </Button>
                      <Button variant="secondary" size="icon-sm" aria-label={`Stop ${container.name}`} onClick={() => void act(container, "stop")} disabled={pending !== null}>
                        {pending === `${container.id}:stop` ? <Loader2 className="animate-spin" /> : <Square strokeWidth={1.75} />}
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="icon-sm" aria-label={`Start ${container.name}`} onClick={() => void act(container, "start")} disabled={pending !== null}>
                      {pending === `${container.id}:start` ? <Loader2 className="animate-spin" /> : <Play strokeWidth={1.75} />}
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </Panel>
        ))
      )}

      <Dialog open={logsFor !== null} onOpenChange={(open) => !open && setLogsFor(null)}>
        <DialogContent className="max-w-[min(1100px,92vw)]">
          <DialogHeader>
            <DialogTitle>{logsFor?.name}</DialogTitle>
          </DialogHeader>
          {logsFor && (
            <LogConsole
              sources={[{ id: logsFor.id, label: logsFor.name, endpointId: logsFor.endpointId, containerId: logsFor.id }]}
              height="h-[clamp(240px,52vh,520px)]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
