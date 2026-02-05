"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { updateServiceAction, deleteServiceAction, deployServiceAction } from "@/app/actions/services";
import {
  ArrowLeft,
  Save,
  Trash2,
  Rocket,
  RefreshCw,
  Server,
  Globe,
  Cloud,
  Container,
  FileText,
  Activity,
  Play,
  Square,
  RotateCcw,
  Cpu,
  Loader2,
  Settings,
  ExternalLink,
} from "lucide-react";
import type { Service } from "@/types";
import { formatDateTime } from "@/lib/utils";
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
  const [isDeploying, setIsDeploying] = useState(false);
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
    deploy_strategy: "pull_restart" as "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
  });

  // Docker management state
  const [logs, setLogs] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [containerStatus, setContainerStatus] = useState<"running" | "stopped" | "unknown">("unknown");
  const [containerAction, setContainerAction] = useState<string | null>(null);

  const hasDockerConfig = service?.type === "docker" && service?.container_id && service?.portainer_endpoint_id;

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

  const performContainerAction = async (action: "start" | "stop" | "restart") => {
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
        container_id: formData.type === "docker" ? formData.container_id || undefined : undefined,
        repo_path: formData.type === "docker" ? formData.repo_path || undefined : undefined,
        compose_project: formData.type === "docker" ? formData.compose_project || undefined : undefined,
        deploy_strategy: formData.type === "docker" ? formData.deploy_strategy : undefined,
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

  const handleDeploy = async () => {
    if (!confirm("Deploy this service? This will pull changes and restart the container.")) {
      return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      const result = await deployServiceAction(serviceId);

      if (!result.success) {
        setError(result.error || "Deployment failed");
        return;
      }

      setSuccess(`Deployment successful! Commit: ${result.data?.commit_sha?.slice(0, 7) || "N/A"}`);
    } catch {
      setError("Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  const typeIcons = {
    docker: <Server className="h-5 w-5" />,
    vercel: <Cloud className="h-5 w-5" />,
    external: <Globe className="h-5 w-5" />,
  };

  const backLink = service?.project_id ? `/projects/${service.project_id}` : "/services";

  if (isLoading) {
    return (
      <>
        <Header title="Service" description="Loading...">
          <Link href="/services">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </Header>
        <div className="p-6 max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (error === "Service not found") {
    return (
      <>
        <Header title="Service Not Found" description="The requested service does not exist">
          <Link href="/services">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Services
            </Button>
          </Link>
        </Header>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Service not found</p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={formData.name || "Service"}
        description={service ? `Created ${formatDateTime(service.created_at)}` : ""}
      >
        <div className="flex items-center gap-2">
          <PageInfoButton {...PAGE_INFO.serviceDetail} />
          <Link href={backLink}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          {formData.type === "docker" && (
            <Button variant="default" size="sm" onClick={handleDeploy} disabled={isDeploying || isSaving || isDeleting}>
              {isDeploying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {isDeploying ? "Deploying..." : "Deploy"}
            </Button>
          )}
        </div>
      </Header>

      <div className="p-6">
        {/* Service Status Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {typeIcons[formData.type]}
          <Badge variant="secondary">{formData.type}</Badge>
          {hasDockerConfig && (
            <Badge variant={containerStatus === "running" ? "default" : "secondary"}>{containerStatus}</Badge>
          )}
          {service?.project_id && (
            <Link href={`/projects/${service.project_id}`}>
              <Badge variant="outline" className="hover:bg-secondary cursor-pointer">
                Project-bound
              </Badge>
            </Link>
          )}
          {!service?.project_id && (
            <Badge variant="outline" className="text-primary border-primary/20">
              Standalone
            </Badge>
          )}
          {formData.url && (
            <a
              href={formData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {formData.url}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Docker Quick Actions */}
          {hasDockerConfig && (
            <div className="flex items-center gap-2 ml-auto">
              {containerStatus === "running" ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => performContainerAction("stop")}
                    disabled={containerAction !== null}
                  >
                    {containerAction === "stop" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => performContainerAction("restart")}
                    disabled={containerAction !== null}
                  >
                    {containerAction === "restart" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performContainerAction("start")}
                  disabled={containerAction !== null}
                >
                  {containerAction === "start" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/containers/${service?.portainer_endpoint_id}/${service?.container_id}`}>
                  <Container className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>

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
            <form onSubmit={handleSubmit} className="max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Edit Service</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && error !== "Service not found" && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                  )}
                  {success && <div className="rounded-lg bg-success/10 p-3 text-sm text-success">{success}</div>}

                  <div className="space-y-2">
                    <Label htmlFor="name">Service Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="health_url">Health Check URL</Label>
                    <Input
                      id="health_url"
                      type="url"
                      value={formData.health_url}
                      onChange={(e) => setFormData({ ...formData, health_url: e.target.value })}
                      placeholder="https://example.com/health"
                    />
                  </div>

                  {formData.type === "docker" && (
                    <>
                      <div className="border-t pt-4">
                        <h3 className="font-medium mb-4">Docker Configuration</h3>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="container_id">Container ID / Name</Label>
                            <Input
                              id="container_id"
                              value={formData.container_id}
                              onChange={(e) => setFormData({ ...formData, container_id: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="repo_path">Repository Path</Label>
                            <Input
                              id="repo_path"
                              value={formData.repo_path}
                              onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                              placeholder="/home/pi/projects/my-app"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="compose_project">Compose Project Name</Label>
                            <Input
                              id="compose_project"
                              value={formData.compose_project}
                              onChange={(e) => setFormData({ ...formData, compose_project: e.target.value })}
                              placeholder="my-app"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="deploy_strategy">Deploy Strategy</Label>
                            <select
                              id="deploy_strategy"
                              value={formData.deploy_strategy}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  deploy_strategy: e.target.value as
                                    | "pull_restart"
                                    | "pull_rebuild"
                                    | "compose_up"
                                    | "manual",
                                })
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="pull_restart">Git Pull + Restart Container</option>
                              <option value="pull_rebuild">Git Pull + Rebuild Image</option>
                              <option value="compose_up">Docker Compose Up</option>
                              <option value="manual">Manual Only</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting || isSaving || isDeploying}
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>

                    <Button type="submit" disabled={isSaving || isDeleting || isDeploying}>
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          {/* Logs Tab (Docker only) */}
          {hasDockerConfig && (
            <TabsContent value="logs">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Container Logs</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchLogs} disabled={logsLoading}>
                    {logsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs max-h-[500px] overflow-auto whitespace-pre-wrap">
                    {logsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : logs ? (
                      logs
                    ) : (
                      <span className="text-muted-foreground">Click refresh to load logs</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Stats Tab (Docker only) */}
          {hasDockerConfig && (
            <TabsContent value="stats">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Performance</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchStats} disabled={statsLoading}>
                    {statsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent>
                  {containerStatus !== "running" ? (
                    <p className="text-center text-muted-foreground py-8">Container is not running</p>
                  ) : statsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : stats ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="text-center p-6 bg-secondary/50 rounded-lg">
                        <Cpu className="h-10 w-10 mx-auto mb-3 text-primary" />
                        <p className="text-3xl font-bold">{stats.cpu_percent.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">CPU Usage</p>
                      </div>
                      <div className="text-center p-6 bg-secondary/50 rounded-lg">
                        <Activity className="h-10 w-10 mx-auto mb-3 text-primary" />
                        <p className="text-3xl font-bold">{stats.memory_percent.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">
                          {formatBytes(stats.memory_usage)} / {formatBytes(stats.memory_limit)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Click refresh to load stats</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
