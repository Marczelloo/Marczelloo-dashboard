"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FormActions,
  FormField,
  FormLayout,
  FormSection,
} from "@/components/layout/form-layout";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import {
  Button,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateServiceAction,
  deleteServiceAction,
} from "@/app/actions/services";
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Server,
  Container,
  FileText,
  Activity,
  Play,
  Square,
  RotateCcw,
  Cpu,
  Loader2,
  Settings,
} from "lucide-react";
import type { Service } from "@/types";
import { toast } from "sonner";

interface ContainerStats {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id: serviceId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "docker" as "docker" | "vercel" | "external",
    url: "",
    health_url: "",
    container_id: "",
    repo_path: "",
    compose_project: "",
    deploy_strategy: "pull_restart" as
      "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
  });

  // Docker management state
  const [logs, setLogs] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [containerStatus, setContainerStatus] = useState<
    "running" | "stopped" | "unknown"
  >("unknown");
  const [containerAction, setContainerAction] = useState<string | null>(null);

  const hasDockerConfig =
    service?.type === "docker" &&
    service?.container_id &&
    service?.portainer_endpoint_id;

  const fetchLogs = useCallback(async () => {
    if (!service?.container_id || !service?.portainer_endpoint_id) return;
    setLogsLoading(true);
    try {
      const response = await fetch("/api/containers/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: service.portainer_endpoint_id,
          containerId: service.container_id,
          tail: 200,
        }),
      });
      const result = await response.json();
      if (result.logs) {
        setLogs(result.logs);
      }
    } catch {
      setLogs("Failed to fetch logs");
    } finally {
      setLogsLoading(false);
    }
  }, [service?.container_id, service?.portainer_endpoint_id]);

  const fetchStats = useCallback(async () => {
    if (!service?.container_id || !service?.portainer_endpoint_id) return;
    setStatsLoading(true);
    try {
      const response = await fetch("/api/containers/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: service.portainer_endpoint_id,
          containerId: service.container_id,
        }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
        setContainerStatus("running");
      } else {
        setContainerStatus("stopped");
      }
    } catch {
      setContainerStatus("unknown");
    } finally {
      setStatsLoading(false);
    }
  }, [service?.container_id, service?.portainer_endpoint_id]);

  const performContainerAction = async (
    action: "start" | "stop" | "restart",
  ) => {
    if (!service?.container_id || !service?.portainer_endpoint_id) return;
    setContainerAction(action);
    try {
      const response = await fetch("/api/containers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: service.portainer_endpoint_id,
          containerId: service.container_id,
          action,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Container ${action} successful`);
        setTimeout(() => fetchStats(), 1000);
      } else {
        toast.error(result.error || `Failed to ${action} container`);
      }
    } catch {
      toast.error(`Failed to ${action} container`);
    } finally {
      setContainerAction(null);
    }
  };

  useEffect(() => {
    async function loadService() {
      try {
        const res = await fetch(`/api/services/${serviceId}`);
        const data = await res.json();
        if (data.service) {
          const s = data.service;
          setService(s);
          setFormData({
            name: s.name || "",
            type: s.type || "docker",
            url: s.url || "",
            health_url: s.health_url || "",
            container_id: s.container_id || "",
            repo_path: s.repo_path || "",
            compose_project: s.compose_project || "",
            deploy_strategy: s.deploy_strategy || "pull_restart",
          });
        } else {
          setError("Service not found");
        }
      } catch {
        setError("Failed to load service");
      }
      setIsLoading(false);
    }
    loadService();
  }, [serviceId]);

  // Fetch Docker stats when service loads
  useEffect(() => {
    if (hasDockerConfig) {
      fetchStats();
    }
  }, [hasDockerConfig, fetchStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const result = await updateServiceAction(serviceId, {
        name: formData.name,
        type: formData.type,
        url: formData.url || undefined,
        health_url: formData.health_url || undefined,
        container_id:
          formData.type === "docker"
            ? formData.container_id || undefined
            : undefined,
        repo_path:
          formData.type === "docker"
            ? formData.repo_path || undefined
            : undefined,
        compose_project:
          formData.type === "docker"
            ? formData.compose_project || undefined
            : undefined,
        deploy_strategy:
          formData.type === "docker" ? formData.deploy_strategy : undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to update service");
        return;
      }

      setSuccess("Service updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this service?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteServiceAction(serviceId);

      if (!result.success) {
        setError(result.error || "Failed to delete service");
        return;
      }

      // Navigate back to services list or project page
      if (service?.project_id) {
        router.push(`/projects/${service.project_id}`);
      } else {
        router.push("/services");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  };

  const backLink = service?.project_id
    ? `/projects/${service.project_id}`
    : "/services";

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Service"
          description="Loading…"
          actions={
            <Link href="/services">
              <Button variant="ghost" size="sm">
                <ArrowLeft />
                Back
              </Button>
            </Link>
          }
        />
        <PageBody className="grid max-w-4xl gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </PageBody>
      </>
    );
  }

  if (error === "Service not found") {
    return (
      <>
        <PageHeader
          title="Service not found"
          description="The requested service does not exist"
          actions={
            <Link href="/services">
              <Button variant="ghost" size="sm">
                <ArrowLeft />
                Back to services
              </Button>
            </Link>
          }
        />
        <PageBody>
          <Panel>
            <EmptyState icon={Server} title="Service not found" />
          </Panel>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={formData.name || "Service"}
        description={
          formData.url || formData.container_id || "External service"
        }
        actions={
          <>
            <Link href={backLink}>
              <Button variant="ghost" size="sm">
                <ArrowLeft />
                Back
              </Button>
            </Link>
            {hasDockerConfig && (
              <>
                {containerStatus === "running" ? (
                  <>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => performContainerAction("stop")}
                      disabled={containerAction !== null}
                    >
                      {containerAction === "stop" ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Square />
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => performContainerAction("restart")}
                      disabled={containerAction !== null}
                    >
                      {containerAction === "restart" ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <RotateCcw />
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => performContainerAction("start")}
                    disabled={containerAction !== null}
                  >
                    {containerAction === "start" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Play />
                    )}
                  </Button>
                )}
                <Button variant="secondary" size="icon-sm" asChild>
                  <Link
                    href={`/containers/${service?.portainer_endpoint_id}/${service?.container_id}`}
                  >
                    <Container />
                  </Link>
                </Button>
              </>
            )}
            {formData.url && (
              <Button variant="secondary" size="sm" asChild>
                <a
                  href={formData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={isDeleting}
              disabled={isSaving}
            >
              <Trash2 />
              Delete
            </Button>
          </>
        }
      />

      <PageBody className="grid gap-4">
        <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
          <div className="min-w-0 px-[18px] py-3.5">
            <p className="text-[11.5px] text-fg-3">Status</p>
            <p className="mt-1.5 flex items-center gap-2 text-[18px] font-semibold leading-tight">
              <StatusDot
                status={
                  hasDockerConfig
                    ? containerStatus === "running"
                      ? "ok"
                      : containerStatus === "stopped"
                        ? "err"
                        : "idle"
                    : "ok"
                }
              />
              {hasDockerConfig ? containerStatus : "External"}
            </p>
            <p className="mt-1 truncate text-[11px] text-fg-4">
              {hasDockerConfig ? "Container state" : "External service"}
            </p>
          </div>
          <div className="min-w-0 px-[18px] py-3.5">
            <p className="text-[11.5px] text-fg-3">Type</p>
            <div className="mt-1.5">
              <Chip mono>{formData.type}</Chip>
            </div>
            <p className="mt-1 truncate text-[11px] text-fg-4">
              Service configuration
            </p>
          </div>
          <div className="min-w-0 px-[18px] py-3.5">
            <p className="text-[11.5px] text-fg-3">Last deploy</p>
            <p className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">
              —
            </p>
            <p className="mt-1 truncate text-[11px] text-fg-4">
              No deploy data available
            </p>
          </div>
          <div className="min-w-0 px-[18px] py-3.5">
            <p className="text-[11.5px] text-fg-3">Open logs</p>
            <p className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">
              {logs ? logs.split("\n").filter(Boolean).length : "—"}
            </p>
            <p className="mt-1 truncate text-[11px] text-fg-4">
              {logs ? "Lines loaded" : "Not available"}
            </p>
          </div>
        </Panel>

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            {hasDockerConfig && (
              <>
                <TabsTrigger value="logs" onClick={() => !logs && fetchLogs()}>
                  <FileText className="h-4 w-4 mr-2" />
                  Logs
                </TabsTrigger>
                <TabsTrigger value="stats" onClick={() => fetchStats()}>
                  <Activity className="h-4 w-4 mr-2" />
                  Stats
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <form onSubmit={handleSubmit}>
              <FormLayout>
                {error && error !== "Service not found" && (
                  <p className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="rounded-md border border-ok/25 bg-ok/10 p-3 text-[13px] text-ok">
                    {success}
                  </p>
                )}

                <FormSection
                  title="Service"
                  description="Names and addresses used across the dashboard."
                >
                  <FormField label="Service name" htmlFor="name">
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </FormField>

                  <FormField label="URL" htmlFor="url">
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) =>
                        setFormData({ ...formData, url: e.target.value })
                      }
                      placeholder="https://example.com"
                    />
                  </FormField>

                  <FormField label="Health check URL" htmlFor="health_url">
                    <Input
                      id="health_url"
                      type="url"
                      value={formData.health_url}
                      onChange={(e) =>
                        setFormData({ ...formData, health_url: e.target.value })
                      }
                      placeholder="https://example.com/health"
                    />
                  </FormField>
                </FormSection>

                {formData.type === "docker" && (
                  <FormSection
                    title="Docker"
                    description="Where this service runs and how it is deployed."
                  >
                    <FormField
                      label="Container ID / name"
                      htmlFor="container_id"
                    >
                      <Input
                        id="container_id"
                        value={formData.container_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            container_id: e.target.value,
                          })
                        }
                      />
                    </FormField>

                    <FormField label="Repository path" htmlFor="repo_path">
                      <Input
                        id="repo_path"
                        value={formData.repo_path}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            repo_path: e.target.value,
                          })
                        }
                        placeholder="/home/pi/projects/my-app"
                      />
                    </FormField>

                    <FormField
                      label="Compose project name"
                      htmlFor="compose_project"
                    >
                      <Input
                        id="compose_project"
                        value={formData.compose_project}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            compose_project: e.target.value,
                          })
                        }
                        placeholder="my-app"
                      />
                    </FormField>

                    <FormField
                      label="Deploy strategy"
                      htmlFor="deploy_strategy"
                    >
                      <Select
                        value={formData.deploy_strategy}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            deploy_strategy:
                              value as typeof formData.deploy_strategy,
                          })
                        }
                      >
                        <SelectTrigger id="deploy_strategy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pull_restart">
                            Git pull + restart container
                          </SelectItem>
                          <SelectItem value="pull_rebuild">
                            Git pull + rebuild image
                          </SelectItem>
                          <SelectItem value="compose_up">
                            Docker Compose up
                          </SelectItem>
                          <SelectItem value="manual">Manual only</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  </FormSection>
                )}

                <FormActions note="Changes are saved to this service.">
                  <Button
                    type="submit"
                    loading={isSaving}
                    disabled={isDeleting}
                  >
                    <Save />
                    Save changes
                  </Button>
                </FormActions>
              </FormLayout>
            </form>
          </TabsContent>

          {/* Logs Tab (Docker only) */}
          {hasDockerConfig && (
            <TabsContent value="logs">
              <Panel className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
                  <h2 className="text-[13.5px] font-semibold">
                    Container logs
                  </h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fetchLogs}
                    disabled={logsLoading}
                  >
                    {logsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="p-3.5">
                  <div className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md border border-line-subtle bg-surface-raised p-3 font-mono text-[11.5px]">
                    {logsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-5 animate-spin text-fg-3" />
                      </div>
                    ) : logs ? (
                      logs
                    ) : (
                      <span className="text-fg-3">
                        Click refresh to load logs
                      </span>
                    )}
                  </div>
                </div>
              </Panel>
            </TabsContent>
          )}

          {/* Stats Tab (Docker only) */}
          {hasDockerConfig && (
            <TabsContent value="stats">
              <Panel className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
                  <h2 className="text-[13.5px] font-semibold">Performance</h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fetchStats}
                    disabled={statsLoading}
                  >
                    {statsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="p-3.5">
                  {containerStatus !== "running" ? (
                    <p className="py-8 text-center text-fg-3">
                      Container is not running
                    </p>
                  ) : statsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-fg-3" />
                    </div>
                  ) : stats ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-md border border-line-subtle bg-surface-raised p-5 text-center">
                        <Cpu className="mx-auto mb-3 size-7 text-accent" />
                        <p className="text-2xl font-semibold tabular-nums">
                          {stats.cpu_percent.toFixed(1)}%
                        </p>
                        <p className="text-[12px] text-fg-3">CPU usage</p>
                      </div>
                      <div className="rounded-md border border-line-subtle bg-surface-raised p-5 text-center">
                        <Activity className="mx-auto mb-3 size-7 text-accent" />
                        <p className="text-2xl font-semibold tabular-nums">
                          {stats.memory_percent.toFixed(1)}%
                        </p>
                        <p className="text-[12px] text-fg-3">
                          {formatBytes(stats.memory_usage)} /{" "}
                          {formatBytes(stats.memory_limit)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-fg-3">
                      Click refresh to load stats
                    </p>
                  )}
                </div>
              </Panel>
            </TabsContent>
          )}
        </Tabs>
      </PageBody>
    </>
  );
}
