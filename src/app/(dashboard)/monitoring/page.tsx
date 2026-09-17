import { Suspense } from "react";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Button } from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import { RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { isDemoMode, checkDemoModeBlocked } from "@/lib/demo-mode";
import { services, uptimeChecks } from "@/server/data";
import { requireAuth } from "@/server/lib/auth";
import { runMonitoring } from "@/server/monitoring";
import { MonitorOverview } from "./_components/monitor-overview";
import type { Service } from "@/types";

async function runMonitoringChecks() {
  "use server";

  if (!checkDemoModeBlocked().blocked) {
    try {
      await requireAuth();
      await runMonitoring();
    } catch (e) {
      console.error("Failed to run monitoring checks:", e);
    }
  }
  revalidatePath("/monitoring");
}

export default function MonitoringPage() {
  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Domains, containers, certificates, and Pi disk"
        actions={
          <form action={runMonitoringChecks}>
            <Button variant="secondary" size="sm" type="submit">
                <RefreshCw className="h-4 w-4" />
                Run Checks
            </Button>
          </form>
        }
      />
      <PageBody className="space-y-6">
        <Suspense fallback={<StatsSkeleton />}>
          {isDemoMode() ? <MonitoringStats /> : <MonitorOverview />}
        </Suspense>

        {/* Services List */}
        <Suspense fallback={<MonitoringListSkeleton />}>
          <MonitoringList />
        </Suspense>
      </PageBody>
    </>
  );
}

async function MonitoringStats() {
  let monitorableServices: Service[] = [];
  try {
    monitorableServices = await services.getMonitorableServices();
  } catch (error) {
    console.error("[MonitoringStats] Failed to load monitorable services:", error);
  }

  // Get latest check for each service
  const checksPromises = monitorableServices.map(async (service) => {
    const stats = await uptimeChecks.getUptimeStats(service.id, 24).catch((error) => {
      console.error(`[MonitoringStats] Failed to load uptime for ${service.id}:`, error);
      return { uptime: 0, avgLatency: 0, checks: 0, lastOk: false };
    });
    return { service, stats };
  });

  const results = await Promise.all(checksPromises);

  const totalServices = monitorableServices.length;
  const upServices = results.filter((r) => r.stats.lastOk).length;
  const avgLatency =
    results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.stats.avgLatency, 0) / results.length) : 0;
  const sslExpiringSoon = 0; // TODO: Track SSL expiry

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Services Monitored</p>
          <p className="text-2xl font-bold">{totalServices}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Currently Up</p>
          <p className="text-2xl font-bold text-success">{upServices}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Avg Response Time</p>
          <p className="text-2xl font-bold">{avgLatency > 0 ? `${avgLatency}ms` : "—"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">SSL Expiring Soon</p>
          <p className="text-2xl font-bold text-warning">{sslExpiringSoon}</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function MonitoringList() {
  let monitorableServices: Service[] = [];
  try {
    monitorableServices = await services.getMonitorableServices();
  } catch (error) {
    console.error("[MonitoringList] Failed to load monitorable services:", error);
  }

  if (monitorableServices.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No services configured for monitoring.</p>
          <p className="text-sm text-muted-foreground mt-2">Add a URL to your services to enable uptime monitoring.</p>
        </CardContent>
      </Card>
    );
  }

  // Get stats for each service
  const servicesWithStats = await Promise.all(
    monitorableServices.map(async (service: Service) => {
      const [stats, latestCheck] = await Promise.all([
        uptimeChecks.getUptimeStats(service.id, 24).catch((error) => {
          console.error(`[MonitoringList] Failed to load uptime for ${service.id}:`, error);
          return { uptime: 0, avgLatency: 0, checks: 0, lastOk: false };
        }),
        uptimeChecks.getLatestCheckByServiceId(service.id).catch((error) => {
          console.error(`[MonitoringList] Failed to load latest check for ${service.id}:`, error);
          return null;
        }),
      ]);
      return { service, stats, latestCheck };
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitored Services</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {servicesWithStats.map(({ service, stats, latestCheck }) => (
            <div
              key={service.id}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-4">
                <StatusDot
                  status={stats.lastOk ? "online" : stats.checks > 0 ? "offline" : "unknown"}
                  size="lg"
                  pulse={!stats.lastOk && stats.checks > 0}
                />
                <div>
                  <div className="font-medium">{service.name}</div>
                  {service.url && (
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {service.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {stats.avgLatency > 0 ? `${Math.round(stats.avgLatency)}ms` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Response Time</p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium">{stats.checks > 0 ? `${stats.uptime.toFixed(1)}%` : "—"}</p>
                  <p className="text-xs text-muted-foreground">Uptime (24h)</p>
                </div>

                <div className="text-right">
                  {latestCheck?.ssl_days_left !== null && latestCheck?.ssl_days_left !== undefined ? (
                    <Badge
                      variant={
                        latestCheck.ssl_days_left > 30
                          ? "success"
                          : latestCheck.ssl_days_left > 14
                            ? "warning"
                            : "danger"
                      }
                    >
                      {latestCheck.ssl_days_left}d SSL
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No SSL</Badge>
                  )}
                </div>

                <div className="text-right text-xs text-muted-foreground min-w-[80px]">
                  {latestCheck?.checked_at ? formatRelativeTime(latestCheck.checked_at) : "Never checked"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  );
}

function MonitoringListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
