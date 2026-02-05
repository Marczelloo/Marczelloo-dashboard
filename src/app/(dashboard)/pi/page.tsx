"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Button } from "@/components/ui";
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

function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  color = "primary",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: "primary" | "success" | "warning" | "destructive";
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const colorClasses = {
    primary: "stroke-primary",
    success: "stroke-green-500",
    warning: "stroke-yellow-500",
    destructive: "stroke-destructive",
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-secondary"
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
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{value}%</span>
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
  return `${mb} MB`;
}

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

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchMetrics();
  };

  if (loading && !metrics) {
    return (
      <>
        <Header title="Raspberry Pi" description="System metrics and status">
          <PageInfoButton {...PAGE_INFO.pi} />
        </Header>
        <div className="p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error && !metrics) {
    return (
      <>
        <Header title="Raspberry Pi" description="System metrics and status">
          <PageInfoButton {...PAGE_INFO.pi} />
        </Header>
        <div className="p-6">
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Metrics</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (!metrics) return null;

  return (
    <>
      <Header title="Raspberry Pi" description="System metrics and status">
        <PageInfoButton {...PAGE_INFO.pi} />
      </Header>

      <div className="p-6 space-y-6">
        {/* Refresh bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">{metrics.hostname}</span>
            </div>
            <span className="text-sm text-muted-foreground">IP: {metrics.network.ip}</span>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* CPU Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">CPU</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4">
              <ProgressRing value={metrics.cpu.usage} color={getUsageColor(metrics.cpu.usage)} />
              <div className="mt-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">{metrics.cpu.cores} cores</p>
                <p className="text-xs text-muted-foreground">
                  Load: {metrics.cpu.load1.toFixed(2)} / {metrics.cpu.load5.toFixed(2)} /{" "}
                  {metrics.cpu.load15.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Memory Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Memory</CardTitle>
              <MemoryStick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4">
              <ProgressRing value={metrics.memory.usagePercent} color={getUsageColor(metrics.memory.usagePercent)} />
              <div className="mt-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                  {formatMB(metrics.memory.used)} / {formatMB(metrics.memory.total)}
                </p>
                <p className="text-xs text-muted-foreground">Available: {formatMB(metrics.memory.available)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Disk Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Disk ({metrics.disk.mount})</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4">
              <ProgressRing value={metrics.disk.usagePercent} color={getUsageColor(metrics.disk.usagePercent)} />
              <div className="mt-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                  {metrics.disk.used} / {metrics.disk.total}
                </p>
                <p className="text-xs text-muted-foreground">Free: {metrics.disk.available}</p>
              </div>
            </CardContent>
          </Card>

          {/* Temperature Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Temperature</CardTitle>
              <Thermometer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4">
              {metrics.temperature !== null ? (
                <>
                  <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
                    <Thermometer
                      className={cn(
                        "h-16 w-16",
                        metrics.temperature < 50 && "text-green-500",
                        metrics.temperature >= 50 && metrics.temperature < 70 && "text-yellow-500",
                        metrics.temperature >= 70 && "text-destructive"
                      )}
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-2xl font-bold">{metrics.temperature.toFixed(1)}°C</p>
                    <p className="text-xs text-muted-foreground">
                      {metrics.temperature < 50 ? "Normal" : metrics.temperature < 70 ? "Warm" : "Hot!"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Not available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Secondary Cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Docker Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Container className="h-5 w-5" />
                Docker
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <p className="text-3xl font-bold text-green-500">{metrics.docker.containersRunning}</p>
                  <p className="text-xs text-muted-foreground mt-1">Running</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <p className="text-3xl font-bold text-yellow-500">{metrics.docker.containersStopped}</p>
                  <p className="text-xs text-muted-foreground mt-1">Stopped</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <p className="text-3xl font-bold text-muted-foreground">{metrics.docker.imagesCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Images</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Hostname</span>
                  </div>
                  <span className="text-sm font-medium">{metrics.hostname}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">IP Address</span>
                  </div>
                  <span className="text-sm font-medium font-mono">{metrics.network.ip}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Uptime</span>
                  </div>
                  <span className="text-sm font-medium">{metrics.uptime}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">CPU Cores</span>
                  </div>
                  <span className="text-sm font-medium">{metrics.cpu.cores}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
