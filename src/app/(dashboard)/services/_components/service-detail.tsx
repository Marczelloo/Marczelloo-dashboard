"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, Container, ExternalLink, KeyRound, Loader2, Play, RotateCcw, Save, ScrollText, Server, Settings, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteServiceAction, updateServiceAction } from "@/app/actions/services";
import { EnvManager } from "@/components/features/env-manager";
import { EnvVersionHistory } from "@/components/features/env-version-history";
import { LogConsole } from "@/components/features/log-console";
import { FormActions, FormField, FormLayout, FormSection } from "@/components/layout/form-layout";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, EmptyState, Input, Meter, Panel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { Service } from "@/types";

interface ContainerStats {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
}

type ContainerState = "running" | "stopped" | "unknown";

const STRATEGY_LABEL: Record<string, string> = {
  pull_restart: "Git pull + restart container",
  pull_rebuild: "Git pull + rebuild image",
  compose_up: "Docker Compose up",
  manual: "Manual only",
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Number((bytes / 1024 ** index).toFixed(1))} ${units[index]}`;
}

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
      <span className="text-fg-3">{label}</span>
      <span className="min-w-0 max-w-full truncate text-right">{children}</span>
    </div>
  );
}

const none = <span className="text-fg-4">not set</span>;

/**
 * One service, however it was reached: from its project or from the services list.
 * Status strip first, then tabs — overview reads, logs and environment operate, settings edits.
 */
export function ServiceDetail({ serviceId, backHref, backLabel }: { serviceId: string; backHref: string; backLabel: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [containerState, setContainerState] = useState<ContainerState>("unknown");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    type: "docker" as Service["type"],
    url: "",
    health_url: "",
    container_id: "",
    repo_path: "",
    compose_project: "",
    deploy_strategy: "pull_restart" as Service["deploy_strategy"],
  });

  const docker = form.type === "docker";
  const endpointId = service?.portainer_endpoint_id ?? null;
  const containerId = service?.container_id ?? null;
  const managed = Boolean(docker && endpointId && containerId);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/services/${serviceId}`);
        const data = (await response.json().catch(() => ({}))) as { service?: Service };
        if (!data.service) {
          setNotFound(true);
        } else {
          setService(data.service);
          setForm({
            name: data.service.name || "",
            type: data.service.type || "docker",
            url: data.service.url || "",
            health_url: data.service.health_url || "",
            container_id: data.service.container_id || "",
            repo_path: data.service.repo_path || "",
            compose_project: data.service.compose_project || "",
            deploy_strategy: data.service.deploy_strategy || "pull_restart",
          });
        }
      } catch {
        setError("Failed to load this service");
      }
      setIsLoading(false);
    }
    void load();
  }, [serviceId]);

  const loadStats = useCallback(async () => {
    if (!endpointId || !containerId) return;
    try {
      const response = await fetch("/api/containers/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; data?: ContainerStats };
      if (data.success && data.data) {
        setStats(data.data);
        setContainerState("running");
      } else {
        setStats(null);
        setContainerState("stopped");
      }
    } catch {
      setContainerState("unknown");
    }
  }, [endpointId, containerId]);

  useEffect(() => {
    if (managed) void loadStats();
  }, [managed, loadStats]);

  async function runAction(action: "start" | "stop" | "restart") {
    if (!endpointId || !containerId) return;
    setPendingAction(action);
    try {
      const response = await fetch("/api/containers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId, action }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (data.success) {
        toast.success(`Container ${action} requested`);
        setTimeout(() => void loadStats(), 1000);
      } else {
        toast.error(data.error ?? `Could not ${action} the container`);
      }
    } catch {
      toast.error(`Could not ${action} the container`);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateServiceAction(serviceId, {
        name: form.name,
        type: form.type,
        url: form.url || undefined,
        health_url: form.health_url || undefined,
        container_id: docker ? form.container_id || undefined : undefined,
        repo_path: docker ? form.repo_path || undefined : undefined,
        compose_project: docker ? form.compose_project || undefined : undefined,
        deploy_strategy: docker ? form.deploy_strategy : undefined,
      });
      if (!result.success) {
        setError(result.error || "Failed to save this service");
        return;
      }
      setSuccess("Saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${form.name || "this service"}? The container itself is left untouched.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteServiceAction(serviceId);
      if (!result.success) {
        setError(result.error || "Failed to delete this service");
        return;
      }
      router.push(backHref);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  }

  const logSources = useMemo(
    () => (managed ? [{ id: serviceId, label: form.name || "service", endpointId: endpointId as number, containerId: containerId as string }] : []),
    [managed, serviceId, form.name, endpointId, containerId]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader title="Service" description="Loading…" />
        <PageBody className="grid gap-4">
          <Skeleton className="h-[88px] rounded-lg" />
          <Skeleton className="h-[420px] rounded-lg" />
        </PageBody>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <PageHeader
          title="Service not found"
          description="It may have been deleted"
          actions={
            <Button variant="ghost" asChild>
              <Link href={backHref}>
                <ArrowLeft strokeWidth={1.75} />
                {backLabel}
              </Link>
            </Button>
          }
        />
        <PageBody>
          <Panel>
            <EmptyState icon={Server} title="Service not found" description="Nothing is stored under this address any more." />
          </Panel>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={form.name || "Service"}
        description={service?.compose_project ? `compose project ${service.compose_project}` : form.container_id || form.url || "External service"}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={backHref}>
                <ArrowLeft strokeWidth={1.75} />
                {backLabel}
              </Link>
            </Button>
            {managed && (
              <>
                {containerState === "running" ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => void runAction("restart")} disabled={pendingAction !== null}>
                      {pendingAction === "restart" ? <Loader2 className="animate-spin" /> : <RotateCcw strokeWidth={1.75} />}
                      Restart
                    </Button>
                    <Button variant="secondary" size="icon-sm" aria-label="Stop container" onClick={() => void runAction("stop")} disabled={pendingAction !== null}>
                      {pendingAction === "stop" ? <Loader2 className="animate-spin" /> : <Square strokeWidth={1.75} />}
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => void runAction("start")} disabled={pendingAction !== null}>
                    {pendingAction === "start" ? <Loader2 className="animate-spin" /> : <Play strokeWidth={1.75} />}
                    Start
                  </Button>
                )}
                <Button variant="secondary" size="icon-sm" aria-label="Open container" asChild>
                  <Link href={`/containers/${endpointId}/${containerId}`}>
                    <Container strokeWidth={1.75} />
                  </Link>
                </Button>
              </>
            )}
            {form.url && (
              <Button variant="secondary" size="icon-sm" aria-label="Open service" asChild>
                <a href={form.url} target="_blank" rel="noreferrer">
                  <ExternalLink strokeWidth={1.75} />
                </a>
              </Button>
            )}
          </>
        }
      />

      <PageBody className="grid gap-4">
        <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
          <Segment label="Status" detail={managed ? "Container state" : "Not managed from here"}>
            <p className="flex items-center gap-2 text-[18px] font-semibold capitalize leading-tight">
              <StatusDot status={managed ? (containerState === "running" ? "ok" : containerState === "stopped" ? "err" : "idle") : "idle"} />
              {managed ? containerState : docker ? "Unknown" : "External"}
            </p>
          </Segment>
          <Segment label="Type" detail={docker ? STRATEGY_LABEL[form.deploy_strategy] : "No deploy pipeline"}>
            <Chip mono>{form.type}</Chip>
          </Segment>
          <Segment label="CPU" detail={stats ? "Of one core" : "Needs a running container"}>
            <p className="text-[18px] font-semibold leading-tight tabular-nums">{stats ? `${stats.cpu_percent.toFixed(1)}%` : "—"}</p>
          </Segment>
          <Segment label="Memory" detail={stats ? `${formatBytes(stats.memory_usage)} of ${formatBytes(stats.memory_limit)}` : "Needs a running container"}>
            <p className="text-[18px] font-semibold leading-tight tabular-nums">{stats ? `${stats.memory_percent.toFixed(1)}%` : "—"}</p>
          </Segment>
        </Panel>

        <Tabs defaultValue="overview" className="flex flex-col">
          <TabsList>
            <TabsTrigger value="overview">
              <Activity strokeWidth={1.75} />
              Overview
            </TabsTrigger>
            {managed && (
              <TabsTrigger value="logs">
                <ScrollText strokeWidth={1.75} />
                Logs
              </TabsTrigger>
            )}
            <TabsTrigger value="environment">
              <KeyRound strokeWidth={1.75} />
              Environment
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings strokeWidth={1.75} />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            {managed ? (
              <LogConsole sources={logSources} height="h-[300px]" />
            ) : (
              <Panel>
                <EmptyState
                  icon={ScrollText}
                  title="No container logs"
                  description={docker ? "Point this service at a container to read its output here." : "External services report through their own provider."}
                />
              </Panel>
            )}
            <div className="flex flex-col gap-4">
              <Panel>
                <div className="border-b border-line-subtle px-3.5 py-3">
                  <h2 className="text-[13.5px] font-semibold">Runtime</h2>
                </div>
                <Fact label="Address">{form.url ? <a href={form.url} target="_blank" rel="noreferrer" className="font-mono text-[12px] hover:underline">{form.url}</a> : none}</Fact>
                <Fact label="Health check">{form.health_url ? <code className="text-[12px] text-fg-2">{form.health_url}</code> : none}</Fact>
                {docker && (
                  <>
                    <Fact label="Container">{form.container_id ? <code className="text-[12px] text-fg-2">{form.container_id}</code> : none}</Fact>
                    <Fact label="Compose project">{form.compose_project ? <code className="text-[12px] text-fg-2">{form.compose_project}</code> : none}</Fact>
                    <Fact label="Repository path">{form.repo_path ? <code className="text-[12px] text-fg-2">{form.repo_path}</code> : none}</Fact>
                    <Fact label="Deploy strategy">{STRATEGY_LABEL[form.deploy_strategy]}</Fact>
                  </>
                )}
                <Fact label="Added">{service ? formatDateTime(service.created_at) : "—"}</Fact>
              </Panel>

              {managed && (
                <Panel>
                  <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-3">
                    <h2 className="text-[13.5px] font-semibold">Resources</h2>
                    <Button variant="ghost" size="sm" onClick={() => void loadStats()}>
                      Refresh
                    </Button>
                  </div>
                  {stats ? (
                    <div className="grid gap-3.5 p-3.5">
                      <Meter label="CPU" value={stats.cpu_percent} display={`${stats.cpu_percent.toFixed(1)}%`} tone={stats.cpu_percent > 80 ? "warn" : "neutral"} />
                      <Meter
                        label="Memory"
                        value={stats.memory_percent}
                        display={`${formatBytes(stats.memory_usage)} / ${formatBytes(stats.memory_limit)}`}
                        tone={stats.memory_percent > 85 ? "warn" : "neutral"}
                      />
                    </div>
                  ) : (
                    <EmptyState icon={Activity} title="No measurements" description="The container reports CPU and memory only while it is running." className="py-6" />
                  )}
                </Panel>
              )}
            </div>
          </TabsContent>

          {managed && (
            <TabsContent value="logs">
              <LogConsole sources={logSources} height="h-[560px]" />
            </TabsContent>
          )}

          <TabsContent value="environment" className="flex flex-col gap-4">
            <EnvManager serviceId={serviceId} serviceName={form.name} repoPath={form.repo_path || undefined} />
            <EnvVersionHistory serviceId={serviceId} refreshKey={0} />
          </TabsContent>

          <TabsContent value="settings">
            <form onSubmit={handleSubmit}>
              <FormLayout className="max-w-none">
                {error && <p className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">{error}</p>}
                {success && <p className="rounded-md border border-ok/25 bg-ok/10 p-3 text-[13px] text-ok">{success}</p>}

                <FormSection title="Service" description="Names and addresses used across the dashboard.">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <FormField label="Service name" htmlFor="name">
                      <Input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                    </FormField>
                    <FormField label="Type" htmlFor="type">
                      <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as Service["type"] })}>
                        <SelectTrigger id="type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="docker">Docker container</SelectItem>
                          <SelectItem value="vercel">Vercel deployment</SelectItem>
                          <SelectItem value="external">External service</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="URL" htmlFor="url" hint="Where visitors reach it.">
                      <Input id="url" type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com" />
                    </FormField>
                    <FormField label="Health check URL" htmlFor="health_url" hint="Polled by the uptime monitor.">
                      <Input id="health_url" type="url" value={form.health_url} onChange={(event) => setForm({ ...form, health_url: event.target.value })} placeholder="https://example.com/health" />
                    </FormField>
                  </div>
                </FormSection>

                {docker && (
                  <FormSection title="Docker" description="Where this service runs and how a deploy reaches it.">
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <FormField label="Container ID / name" htmlFor="container_id">
                        <Input id="container_id" className="font-mono" value={form.container_id} onChange={(event) => setForm({ ...form, container_id: event.target.value })} />
                      </FormField>
                      <FormField label="Compose project name" htmlFor="compose_project">
                        <Input id="compose_project" className="font-mono" value={form.compose_project} onChange={(event) => setForm({ ...form, compose_project: event.target.value })} />
                      </FormField>
                      <FormField label="Repository path" htmlFor="repo_path" hint="Absolute path on the Pi.">
                        <Input id="repo_path" className="font-mono" value={form.repo_path} onChange={(event) => setForm({ ...form, repo_path: event.target.value })} placeholder="/home/pi/projects/my-app" />
                      </FormField>
                      <FormField label="Deploy strategy" htmlFor="deploy_strategy">
                        <Select value={form.deploy_strategy} onValueChange={(value) => setForm({ ...form, deploy_strategy: value as Service["deploy_strategy"] })}>
                          <SelectTrigger id="deploy_strategy">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STRATEGY_LABEL).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                    </div>
                  </FormSection>
                )}

                <FormActions note="Changes apply the next time this service is deployed or checked.">
                  <Button type="submit" loading={isSaving} disabled={isDeleting}>
                    <Save strokeWidth={1.75} />
                    Save changes
                  </Button>
                </FormActions>

                <FormSection title="Danger zone" description="Removing the service leaves the container running; only the dashboard forgets it." tone="danger">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[12.5px] text-fg-3">Deploys, env history and uptime checks of this service are removed with it.</p>
                    <Button variant="danger" onClick={handleDelete} loading={isDeleting} disabled={isSaving} type="button">
                      <Trash2 strokeWidth={1.75} />
                      Delete service
                    </Button>
                  </div>
                </FormSection>
              </FormLayout>
            </form>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
