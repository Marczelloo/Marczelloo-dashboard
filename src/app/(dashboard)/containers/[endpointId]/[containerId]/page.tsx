"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, Box, Boxes, FolderOpen, KeyRound, Loader2, Network, Play, RotateCcw, ScrollText, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LogConsole } from "@/components/features/log-console";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Chip,
  EmptyState,
  Meter,
  Panel,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { formatBytes } from "@/lib/host";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

interface ContainerInspect {
  Id: string;
  Created: string;
  Path: string;
  Args: string[];
  State: { Status: string; Running: boolean; Restarting: boolean; OOMKilled: boolean; ExitCode: number; Error: string; StartedAt: string; FinishedAt: string };
  Image: string;
  Name: string;
  RestartCount: number;
  Driver: string;
  Platform: string;
  Mounts: Array<{ Type: string; Source: string; Destination: string; Mode: string; RW: boolean }>;
  Config: { Hostname: string; Env: string[]; Cmd: string[]; Image: string; WorkingDir: string; Labels: Record<string, string> };
  NetworkSettings: { IPAddress: string; Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null> };
  HostConfig: { Memory: number; CpuShares: number; RestartPolicy: { Name: string; MaximumRetryCount: number } };
}

interface ContainerStats {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  network_rx?: number;
  network_tx?: number;
  block_read?: number;
  block_write?: number;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Box; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="flex items-center gap-2 border-b border-line-subtle px-3.5 py-3">
        <Icon className="size-4 text-fg-3" strokeWidth={1.75} />
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
      </div>
      {children}
    </Panel>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
      <span className="shrink-0 text-fg-3">{label}</span>
      <span className="min-w-0 max-w-full truncate text-right">{children}</span>
    </div>
  );
}

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

/** One container: what it is, what it is doing, and the handles to work it. */
export default function ContainerDetailPage({ params }: { params: Promise<{ endpointId: string; containerId: string }> }) {
  const { endpointId: endpointParam, containerId } = use(params);
  const endpointId = Number(endpointParam);
  const router = useRouter();

  const [inspect, setInspect] = useState<ContainerInspect | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/containers/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId }),
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean; data?: ContainerInspect; error?: string };
      if (result.success && result.data) {
        setInspect(result.data);
        setError(null);
      } else {
        setError(result.error ?? "Container not found");
      }
    } catch {
      setError("Could not reach docker");
    } finally {
      setLoading(false);
    }
  }, [endpointId, containerId]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/containers/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId }),
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean; data?: ContainerStats };
      setStats(result.success && result.data ? result.data : null);
    } catch {
      setStats(null);
    }
  }, [endpointId, containerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (inspect?.State.Running) void loadStats();
  }, [inspect?.State.Running, loadStats]);

  async function act(action: "start" | "stop" | "restart" | "remove") {
    setPending(action);
    try {
      const response = await fetch("/api/containers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId, action }),
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error ?? `Could not ${action} the container`);
        return;
      }
      toast.success(`Container ${action} requested`);
      if (action === "remove") {
        router.push("/host?tab=containers");
        return;
      }
      setTimeout(() => void load(), 1200);
    } catch {
      toast.error(`Could not ${action} the container`);
    } finally {
      setPending(null);
      setConfirmRemove(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Container" description="Loading…" />
        <PageBody className="grid gap-4">
          <Skeleton className="h-[88px] rounded-lg" />
          <Skeleton className="h-[420px] rounded-lg" />
        </PageBody>
      </>
    );
  }

  if (error || !inspect) {
    return (
      <>
        <PageHeader
          title="Container not found"
          description="It may have been removed or renamed"
          actions={
            <Button variant="ghost" asChild>
              <Link href="/host?tab=containers">
                <ArrowLeft strokeWidth={1.75} />
                Back to containers
              </Link>
            </Button>
          }
        />
        <PageBody>
          <Panel>
            <EmptyState icon={Box} title="Nothing to show" description={error ?? "Docker does not know this container."} />
          </Panel>
        </PageBody>
      </>
    );
  }

  const name = inspect.Name.replace(/^\//, "");
  const running = inspect.State.Running;
  const project = inspect.Config.Labels["com.docker.compose.project"] ?? null;
  const ports = Object.entries(inspect.NetworkSettings.Ports ?? {});

  return (
    <>
      <PageHeader
        title={name}
        description={`${inspect.Config.Image}${project ? ` · ${project}` : ""}`}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href="/host?tab=containers">
                <ArrowLeft strokeWidth={1.75} />
                Back to containers
              </Link>
            </Button>
            {running ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => void act("restart")} disabled={pending !== null}>
                  {pending === "restart" ? <Loader2 className="animate-spin" /> : <RotateCcw strokeWidth={1.75} />}
                  Restart
                </Button>
                <Button variant="secondary" size="icon-sm" aria-label="Stop container" onClick={() => void act("stop")} disabled={pending !== null}>
                  {pending === "stop" ? <Loader2 className="animate-spin" /> : <Square strokeWidth={1.75} />}
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => void act("start")} disabled={pending !== null}>
                {pending === "start" ? <Loader2 className="animate-spin" /> : <Play strokeWidth={1.75} />}
                Start
              </Button>
            )}
            <Button variant="danger" size="icon-sm" aria-label="Remove container" onClick={() => setConfirmRemove(true)} disabled={pending !== null}>
              <Trash2 strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      <PageBody className="grid gap-4">
        <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
          <Segment label="State" detail={running ? `Started ${formatRelativeTime(inspect.State.StartedAt)}` : inspect.State.Error || `Exit code ${inspect.State.ExitCode}`}>
            <span className="flex items-center gap-2 capitalize">
              <StatusDot status={running ? "ok" : "err"} />
              {inspect.State.Status}
            </span>
          </Segment>
          <Segment label="CPU" detail={stats ? "Of one core" : "Needs a running container"}>
            {stats ? `${stats.cpu_percent.toFixed(1)}%` : "—"}
          </Segment>
          <Segment label="Memory" detail={stats ? `${formatBytes(stats.memory_usage)} of ${formatBytes(stats.memory_limit)}` : "Needs a running container"}>
            {stats ? `${stats.memory_percent.toFixed(1)}%` : "—"}
          </Segment>
          <Segment label="Restarts" detail={`Policy: ${inspect.HostConfig.RestartPolicy.Name || "none"}`}>
            {inspect.RestartCount}
          </Segment>
        </Panel>

        <Tabs defaultValue="overview" className="flex flex-col">
          <TabsList>
            <TabsTrigger value="overview">
              <Activity strokeWidth={1.75} />
              Overview
            </TabsTrigger>
            <TabsTrigger value="logs">
              <ScrollText strokeWidth={1.75} />
              Logs
            </TabsTrigger>
            <TabsTrigger value="environment">
              <KeyRound strokeWidth={1.75} />
              Environment
            </TabsTrigger>
            <TabsTrigger value="mounts">
              <FolderOpen strokeWidth={1.75} />
              Mounts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
            <Card title="Container" icon={Box}>
              <Fact label="Id">
                <code className="text-[12px] text-fg-2">{inspect.Id.slice(0, 12)}</code>
              </Fact>
              <Fact label="Image">
                <code className="text-[12px] text-fg-2">{inspect.Config.Image}</code>
              </Fact>
              <Fact label="Command">
                <code className="text-[12px] text-fg-2">{[inspect.Path, ...(inspect.Args ?? [])].join(" ")}</code>
              </Fact>
              <Fact label="Working directory">
                <code className="text-[12px] text-fg-2">{inspect.Config.WorkingDir || "/"}</code>
              </Fact>
              <Fact label="Created">{formatDateTime(inspect.Created)}</Fact>
              <Fact label="Platform">{inspect.Platform}</Fact>
            </Card>

            <Card title="Network" icon={Network}>
              <Fact label="Address">
                <code className="text-[12px] text-fg-2">{inspect.NetworkSettings.IPAddress || "edge network only"}</code>
              </Fact>
              {ports.length === 0 ? (
                <Fact label="Ports">not published</Fact>
              ) : (
                ports.map(([port, bindings]) => (
                  <Fact key={port} label={port}>
                    {bindings?.length ? (
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {bindings.map((binding) => (
                          <Chip key={`${binding.HostIp}:${binding.HostPort}`} mono>
                            {binding.HostIp}:{binding.HostPort}
                          </Chip>
                        ))}
                      </span>
                    ) : (
                      <span className="text-fg-4">container only</span>
                    )}
                  </Fact>
                ))
              )}
            </Card>

            {stats && (
              <Card title="Resources" icon={Boxes}>
                <div className="grid gap-3.5 p-3.5">
                  <Meter label="CPU" value={stats.cpu_percent} display={`${stats.cpu_percent.toFixed(1)}%`} tone={stats.cpu_percent > 80 ? "warn" : "neutral"} />
                  <Meter
                    label="Memory"
                    value={stats.memory_percent}
                    display={`${formatBytes(stats.memory_usage)} / ${formatBytes(stats.memory_limit)}`}
                    tone={stats.memory_percent > 85 ? "warn" : "neutral"}
                  />
                </div>
                {stats.network_rx !== undefined && (
                  <Fact label="Network">
                    {formatBytes(stats.network_rx)} in · {formatBytes(stats.network_tx ?? 0)} out
                  </Fact>
                )}
                {stats.block_read !== undefined && (
                  <Fact label="Disk">
                    {formatBytes(stats.block_read)} read · {formatBytes(stats.block_write ?? 0)} written
                  </Fact>
                )}
              </Card>
            )}

            <Card title="Labels" icon={Boxes}>
              {Object.entries(inspect.Config.Labels ?? {}).length === 0 ? (
                <EmptyState icon={Boxes} title="No labels" description="Nothing tags this container." className="py-6" />
              ) : (
                Object.entries(inspect.Config.Labels).map(([key, value]) => (
                  <Fact key={key} label={key}>
                    <code className="text-[12px] text-fg-2">{value}</code>
                  </Fact>
                ))
              )}
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <LogConsole sources={[{ id: inspect.Id, label: name, endpointId, containerId }]} />
          </TabsContent>

          <TabsContent value="environment">
            <Card title="Environment" icon={KeyRound}>
              {inspect.Config.Env?.length ? (
                inspect.Config.Env.map((entry) => {
                  const index = entry.indexOf("=");
                  const key = index === -1 ? entry : entry.slice(0, index);
                  const value = index === -1 ? "" : entry.slice(index + 1);
                  return (
                    <Fact key={entry} label={key}>
                      <code className="text-[12px] text-fg-2">{value}</code>
                    </Fact>
                  );
                })
              ) : (
                <EmptyState icon={KeyRound} title="No variables" description="This container runs on its image defaults." className="py-6" />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="mounts">
            <Card title="Mounts" icon={FolderOpen}>
              {inspect.Mounts?.length ? (
                inspect.Mounts.map((mount) => (
                  <Fact key={`${mount.Source}:${mount.Destination}`} label={mount.Destination}>
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <code className="truncate text-[12px] text-fg-2">{mount.Source}</code>
                      <Chip mono>{mount.Type}</Chip>
                      <Chip tone={mount.RW ? "neutral" : "idle"}>{mount.RW ? "rw" : "ro"}</Chip>
                    </span>
                  </Fact>
                ))
              ) : (
                <EmptyState icon={FolderOpen} title="No mounts" description="Everything this container writes stays in its own layer." className="py-6" />
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The container is deleted from the host. Anything not stored in a volume or a bind mount is lost, and a compose project recreates it on the next deploy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void act("remove")}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
