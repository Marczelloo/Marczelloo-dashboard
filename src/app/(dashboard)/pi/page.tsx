"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Button, Badge } from "@/components/ui";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Thermometer,
  Container,
  Wifi,
  Clock,
  RefreshCw,
  Server,
  Activity,
  Zap,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PiMetrics {
  hostname: string;
  uptime: string;
  cpu: {
    usage: number;
    cores: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available: number;
    usagePercent: number;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    usagePercent: number;
    mount: string;
  };
  temperature: number | null;
  docker: {
    containersRunning: number;
    containersStopped: number;
    imagesCount: number;
  };
  network: {
    ip: string;
  };
}

// ============================================================================
// Components
// ============================================================================

function ProgressRing({
  value,
  size = 100,
  strokeWidth = 6,
  color = "primary",
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: "primary" | "success" | "warning" | "destructive";
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const colorClasses = {
    primary: "stroke-primary",
    success: "stroke-green-500",
    warning: "stroke-yellow-500",
    destructive: "stroke-red-500",
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-secondary/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-500", colorClasses[color])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{value}%</span>
        {label && <span className="text-xs text-muted-foreground mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

function getUsageColor(percent: number): "success" | "warning" | "destructive" {
  if (percent < 60) return "success";
  if (percent < 85) return "warning";
  return "destructive";
}

function formatMB(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(0)} MB`;
}

function getTemperatureStatus(temp: number): { label: string; color: "success" | "warning" | "destructive" } {
  if (temp < 50) return { label: "Normal", color: "success" };
  if (temp < 70) return { label: "Warm", color: "warning" };
  return { label: "Hot!", color: "destructive" };
}

// ============================================================================
// Main Component
// ============================================================================

export default function PiMetricsPage() {
  const [metrics, setMetrics] = useState<PiMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/pi/metrics");
      const result = await response.json();

      if (result.success) {
        setMetrics(result.data);
        setLastUpdated(new Date());
      } else {
        setError(result.error || "Failed to fetch metrics");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchMetrics();
  };

  // Loading State
  if (loading && !metrics) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col min-w-0">
          <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error State
  if (error && !metrics) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-destructive/10 mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Connection Failed</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!metrics) return null;

  const tempStatus = metrics.temperature !== null ? getTemperatureStatus(metrics.temperature) : null;
  const overallHealth =
    metrics.cpu.usage < 85 && metrics.memory.usagePercent < 85 && metrics.disk.usagePercent < 85
      ? "healthy"
      : metrics.cpu.usage < 95 && metrics.memory.usagePercent < 95 && metrics.disk.usagePercent < 95
        ? "warning"
        : "critical";

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  overallHealth === "healthy" && "bg-green-500/10",
                  overallHealth === "warning" && "bg-yellow-500/10",
                  overallHealth === "critical" && "bg-red-500/10"
                )}
              >
                <Server
                  className={cn(
                    "h-6 w-6",
                    overallHealth === "healthy" && "text-green-500",
                    overallHealth === "warning" && "text-yellow-500",
                    overallHealth === "critical" && "text-red-500"
                  )}
                />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-semibold">{metrics.hostname}</h1>
                  <Badge
                    variant={
                      overallHealth === "healthy" ? "success" : overallHealth === "warning" ? "warning" : "danger"
                    }
                    className="text-xs"
                  >
                    {overallHealth === "healthy" ? "Healthy" : overallHealth === "warning" ? "Warning" : "Critical"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">{metrics.network.ip}</span>
                  <span>•</span>
                  <span>Up {metrics.uptime}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</span>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <PageInfoButton {...PAGE_INFO.pi} />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6">
          <div className="space-y-6">
            {/* Primary Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* CPU */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      CPU
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {metrics.cpu.cores} cores
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="relative flex flex-col items-center py-4">
                  <ProgressRing value={metrics.cpu.usage} color={getUsageColor(metrics.cpu.usage)} label="usage" />
                  <div className="w-full mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Load (1m/5m/15m)</span>
                      <span className="font-mono">
                        {metrics.cpu.load1.toFixed(2)} / {metrics.cpu.load5.toFixed(2)} /{" "}
                        {metrics.cpu.load15.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Memory */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-blue-500" />
                      Memory
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {formatMB(metrics.memory.total)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="relative flex flex-col items-center py-4">
                  <ProgressRing
                    value={metrics.memory.usagePercent}
                    color={getUsageColor(metrics.memory.usagePercent)}
                    label="used"
                  />
                  <div className="w-full mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Used</span>
                      <span className="font-medium">{formatMB(metrics.memory.used)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Available</span>
                      <span className="font-medium">{formatMB(metrics.memory.available)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Disk */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-purple-500" />
                      Disk
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {metrics.disk.mount}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="relative flex flex-col items-center py-4">
                  <ProgressRing
                    value={metrics.disk.usagePercent}
                    color={getUsageColor(metrics.disk.usagePercent)}
                    label="used"
                  />
                  <div className="w-full mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Used</span>
                      <span className="font-medium">{metrics.disk.used}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Free</span>
                      <span className="font-medium">{metrics.disk.available}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Temperature */}
              <Card className="relative overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br to-transparent",
                    tempStatus?.color === "success" && "from-green-500/5",
                    tempStatus?.color === "warning" && "from-yellow-500/5",
                    tempStatus?.color === "destructive" && "from-red-500/5",
                    !tempStatus && "from-secondary/5"
                  )}
                />
                <CardHeader className="relative pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Thermometer
                        className={cn(
                          "h-4 w-4",
                          tempStatus?.color === "success" && "text-green-500",
                          tempStatus?.color === "warning" && "text-yellow-500",
                          tempStatus?.color === "destructive" && "text-red-500",
                          !tempStatus && "text-muted-foreground"
                        )}
                      />
                      Temperature
                    </CardTitle>
                    {tempStatus && (
                      <Badge
                        variant={
                          tempStatus.color === "success"
                            ? "success"
                            : tempStatus.color === "warning"
                              ? "warning"
                              : "danger"
                        }
                        className="text-xs"
                      >
                        {tempStatus.label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="relative flex flex-col items-center justify-center py-4">
                  {metrics.temperature !== null ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Zap
                          className={cn(
                            "h-8 w-8",
                            tempStatus?.color === "success" && "text-green-500",
                            tempStatus?.color === "warning" && "text-yellow-500",
                            tempStatus?.color === "destructive" && "text-red-500 animate-pulse"
                          )}
                        />
                        <span className="text-4xl font-bold tabular-nums">{metrics.temperature.toFixed(1)}°</span>
                      </div>
                      <div className="w-full mt-6">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>0°</span>
                          <span>50°</span>
                          <span>100°</span>
                        </div>
                        <div className="h-2 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full relative">
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border-2 border-current"
                            style={{
                              left: `${Math.min(metrics.temperature, 100)}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      <Thermometer className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Not available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Secondary Metrics */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Docker Stats - Larger */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Container className="h-5 w-5 text-blue-500" />
                    Docker Containers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="relative overflow-hidden rounded-xl bg-green-500/10 p-6">
                      <div className="absolute top-2 right-2">
                        <Activity className="h-4 w-4 text-green-500" />
                      </div>
                      <p className="text-4xl font-bold text-green-500">{metrics.docker.containersRunning}</p>
                      <p className="text-sm text-muted-foreground mt-1">Running</p>
                      <div className="mt-3 h-1 bg-green-500/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${(metrics.docker.containersRunning / (metrics.docker.containersRunning + metrics.docker.containersStopped || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-xl bg-yellow-500/10 p-6">
                      <div className="absolute top-2 right-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                      </div>
                      <p className="text-4xl font-bold text-yellow-500">{metrics.docker.containersStopped}</p>
                      <p className="text-sm text-muted-foreground mt-1">Stopped</p>
                    </div>
                    <div className="relative overflow-hidden rounded-xl bg-secondary/50 p-6">
                      <div className="absolute top-2 right-2">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-4xl font-bold">{metrics.docker.imagesCount}</p>
                      <p className="text-sm text-muted-foreground mt-1">Images</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Info - Compact */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    System Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between group cursor-default">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Hostname</span>
                    </div>
                    <span className="text-sm font-medium">{metrics.hostname}</span>
                  </div>
                  <div className="h-px bg-border/50" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">IP Address</span>
                    </div>
                    <span className="text-sm font-medium font-mono">{metrics.network.ip}</span>
                  </div>
                  <div className="h-px bg-border/50" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Uptime</span>
                    </div>
                    <span className="text-sm font-medium">{metrics.uptime}</span>
                  </div>
                  <div className="h-px bg-border/50" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">CPU Cores</span>
                    </div>
                    <span className="text-sm font-medium">{metrics.cpu.cores}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="border-dashed">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Manage Containers</p>
                      <p className="text-sm text-muted-foreground">View and control Docker containers via Portainer</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/containers">
                      Open Containers
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
