"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Loader2,
  FileText,
  Cpu,
  HardDrive,
  Network,
  Settings,
  FolderOpen,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ContainerInspect {
  Id: string;
  Created: string;
  Path: string;
  Args: string[];
  State: {
    Status: string;
    Running: boolean;
    Paused: boolean;
    Restarting: boolean;
    OOMKilled: boolean;
    Dead: boolean;
    Pid: number;
    ExitCode: number;
    Error: string;
    StartedAt: string;
    FinishedAt: string;
  };
  Image: string;
  Name: string;
  RestartCount: number;
  Driver: string;
  Platform: string;
  Mounts: Array<{
    Type: string;
    Source: string;
    Destination: string;
    Mode: string;
    RW: boolean;
  }>;
  Config: {
    Hostname: string;
    Env: string[];
    Cmd: string[];
    Image: string;
    WorkingDir: string;
    Labels: Record<string, string>;
  };
  NetworkSettings: {
    IPAddress: string;
    Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null>;
  };
  HostConfig: {
    Memory: number;
    CpuShares: number;
    RestartPolicy: { Name: string; MaximumRetryCount: number };
  };
}

interface ContainerStats {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  network_rx: number;
  network_tx: number;
  block_read: number;
  block_write: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

interface PageProps {
  params: Promise<{ endpointId: string; containerId: string }>;
}

export default function ContainerDetailPage({ params }: PageProps) {
  const { endpointId: endpointIdStr, containerId } = use(params);
  const endpointId = parseInt(endpointIdStr);
  const router = useRouter();

  const [inspect, setInspect] = useState<ContainerInspect | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInspect = useCallback(async () => {
    try {
      const response = await fetch(`/api/containers/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId }),
      });
      const result = await response.json();
      if (result.success) {
        setInspect(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to fetch container details");
    } finally {
      setLoading(false);
    }
  }, [endpointId, containerId]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch(`/api/containers/stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId }),
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch {
      // Stats may fail for stopped containers
    } finally {
      setStatsLoading(false);
    }
  }, [endpointId, containerId]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/containers/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId, tail: 500 }),
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
  }, [endpointId, containerId]);

  useEffect(() => {
    fetchInspect();
  }, [fetchInspect]);

  async function performAction(action: "start" | "stop" | "restart" | "kill" | "remove") {
    setActionInProgress(action);
    try {
      const response = await fetch("/api/containers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, containerId, action }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Container ${action} successful`);
        if (action === "remove") {
          router.push("/containers");
        } else {
          fetchInspect();
        }
      } else {
        toast.error(result.error || `Failed to ${action} container`);
      }
    } catch {
      toast.error(`Failed to ${action} container`);
    } finally {
      setActionInProgress(null);
      setConfirmRemove(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Container Details" description="Loading..." />
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </>
    );
  }

  if (error || !inspect) {
    return (
      <>
        <Header title="Container Details" description="Error loading container" />
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-danger">{error || "Container not found"}</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push("/containers")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Containers
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const name = inspect.Name.replace(/^\//, "");
  const isRunning = inspect.State.Running;
  const status = inspect.State.Status;

  return (
    <>
      <Header title={name} description={`Container ${containerId.slice(0, 12)}`}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/containers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={fetchInspect}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Header>

      <div className="p-6 space-y-6">
        {/* Status and Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <StatusDot status={isRunning ? "online" : "offline"} size="lg" />
                <div>
                  <h2 className="text-lg font-semibold">{name}</h2>
                  <p className="text-sm text-muted-foreground">{inspect.Config.Image}</p>
                </div>
                <Badge variant={isRunning ? "default" : "secondary"}>{status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => performAction("stop")}
                      disabled={actionInProgress !== null}
                    >
                      {actionInProgress === "stop" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4 mr-1" />
                      )}
                      Stop
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => performAction("restart")}
                      disabled={actionInProgress !== null}
                    >
                      {actionInProgress === "restart" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1" />
                      )}
                      Restart
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => performAction("start")}
                    disabled={actionInProgress !== null}
                  >
                    {actionInProgress === "start" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Start
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmRemove(true)}
                  disabled={actionInProgress !== null}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <Settings className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="logs" onClick={() => !logs && fetchLogs()}>
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="stats" onClick={() => !stats && fetchStats()}>
              <Cpu className="h-4 w-4 mr-2" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="mounts">
              <FolderOpen className="h-4 w-4 mr-2" />
              Mounts
            </TabsTrigger>
            <TabsTrigger value="network">
              <Network className="h-4 w-4 mr-2" />
              Network
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Container Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono">{inspect.Id.slice(0, 12)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(inspect.Created)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span>
                      {inspect.State.StartedAt !== "0001-01-01T00:00:00Z" ? formatDate(inspect.State.StartedAt) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restart Count</span>
                    <span>{inspect.RestartCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PID</span>
                    <span>{inspect.State.Pid || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Driver</span>
                    <span>{inspect.Driver}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Image</span>
                    <span className="font-mono text-xs truncate max-w-[200px]">{inspect.Config.Image}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hostname</span>
                    <span className="font-mono">{inspect.Config.Hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Working Dir</span>
                    <span className="font-mono">{inspect.Config.WorkingDir || "/"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restart Policy</span>
                    <span>{inspect.HostConfig.RestartPolicy.Name}</span>
                  </div>
                  {inspect.Config.Cmd && inspect.Config.Cmd.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Command</span>
                      <p className="font-mono text-xs mt-1 bg-secondary/50 p-2 rounded">
                        {inspect.Config.Cmd.join(" ")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Environment Variables */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Environment Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-secondary/50 rounded-lg p-3 font-mono text-xs max-h-64 overflow-auto space-y-1">
                    {inspect.Config.Env?.map((env, i) => (
                      <div key={i} className="break-all">
                        {env}
                      </div>
                    )) || <p className="text-muted-foreground">No environment variables</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs Tab */}
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
                  ) : (
                    logs || "No logs available. Click refresh to load."
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Performance Stats</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchStats} disabled={statsLoading || !isRunning}>
                  {statsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {!isRunning ? (
                  <p className="text-center text-muted-foreground py-8">Container is not running</p>
                ) : statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stats ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="text-center p-4 bg-secondary/50 rounded-lg">
                      <Cpu className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{stats.cpu_percent.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">CPU Usage</p>
                    </div>
                    <div className="text-center p-4 bg-secondary/50 rounded-lg">
                      <HardDrive className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{stats.memory_percent.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(stats.memory_usage)} / {formatBytes(stats.memory_limit)}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-secondary/50 rounded-lg">
                      <Network className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-2xl font-bold">{formatBytes(stats.network_rx)}</p>
                      <p className="text-xs text-muted-foreground">Network RX</p>
                    </div>
                    <div className="text-center p-4 bg-secondary/50 rounded-lg">
                      <Network className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-2xl font-bold">{formatBytes(stats.network_tx)}</p>
                      <p className="text-xs text-muted-foreground">Network TX</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Click refresh to load stats</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mounts Tab */}
          <TabsContent value="mounts">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Volume Mounts</CardTitle>
              </CardHeader>
              <CardContent>
                {inspect.Mounts && inspect.Mounts.length > 0 ? (
                  <div className="space-y-3">
                    {inspect.Mounts.map((mount, i) => (
                      <div key={i} className="p-3 bg-secondary/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{mount.Type}</Badge>
                          <Badge variant={mount.RW ? "default" : "outline"}>{mount.RW ? "RW" : "RO"}</Badge>
                        </div>
                        <div className="font-mono text-xs space-y-1">
                          <p>
                            <span className="text-muted-foreground">Source:</span> {mount.Source}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Target:</span> {mount.Destination}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No volume mounts</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Network Tab */}
          <TabsContent value="network">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Network Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="font-mono">{inspect.NetworkSettings.IPAddress || "—"}</span>
                </div>
                {inspect.NetworkSettings.Ports && Object.keys(inspect.NetworkSettings.Ports).length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-2">Port Mappings</p>
                    <div className="space-y-2">
                      {Object.entries(inspect.NetworkSettings.Ports).map(([containerPort, hostBindings]) => (
                        <div key={containerPort} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="font-mono">
                            {containerPort}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          {hostBindings?.map((binding, i) => (
                            <Badge key={i} variant="secondary" className="font-mono">
                              {binding.HostIp || "0.0.0.0"}:{binding.HostPort}
                            </Badge>
                          )) || <span className="text-muted-foreground">Not bound</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Remove Confirmation */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Container?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the container {name}.
              {isRunning && " The container is currently running and will be force stopped."}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performAction("remove")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionInProgress === "remove" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
