import { Card, CardContent } from "@/components/ui";
import { FolderKanban, Server, CheckCircle, AlertTriangle } from "lucide-react";
import { projects, services, workItems, uptimeChecks } from "@/server/atlashub";
import type { Project, Service, WorkItem } from "@/types";

async function getStats() {
  const [allProjects, allServices, openWorkItems] = await Promise.all([
    projects.getProjects(),
    services.getServices(),
    workItems.getOpenWorkItems(),
  ]);

  const activeProjects = allProjects.filter((p: Project) => p.status === "active");
  const inProgressItems = openWorkItems.filter((w: WorkItem) => w.status === "in_progress");

  // Calculate overall monitoring stats
  const monitoringStats = await calculateMonitoringStats(allServices);

  return {
    projects: { total: allProjects.length, active: activeProjects.length },
    services: { total: allServices.length, healthy: allServices.length },
    workItems: { open: openWorkItems.length, inProgress: inProgressItems.length },
    monitoring: monitoringStats,
  };
}

async function calculateMonitoringStats(allServices: Service[]) {
  // Get services with URLs (that can be monitored)
  const monitorableServices = allServices.filter((s: Service) => s.url || s.health_url);

  if (monitorableServices.length === 0) {
    return { uptime: null, alerts: 0 };
  }

  // Fetch stats for each service
  const statsPromises = monitorableServices.map((s: Service) =>
    uptimeChecks.getUptimeStats(s.id, 24).catch(() => ({ uptime: 0, avgLatency: 0, checks: 0, lastOk: false }))
  );
  const allStats = await Promise.all(statsPromises);

  // Filter services that actually have checks
  const servicesWithChecks = allStats.filter((s) => s.checks > 0);

  if (servicesWithChecks.length === 0) {
    return { uptime: null, alerts: 0 };
  }

  // Calculate overall uptime as average of all services
  const totalUptime = servicesWithChecks.reduce((sum, s) => sum + s.uptime, 0);
  const avgUptime = Math.round((totalUptime / servicesWithChecks.length) * 10) / 10;

  // Count alerts (services currently down)
  const alerts = allStats.filter((s) => s.checks > 0 && !s.lastOk).length;

  return { uptime: avgUptime, alerts };
}

export async function DashboardStats() {
  const stats = await getStats();

  const cards = [
    {
      label: "Projects",
      value: stats.projects.total,
      subValue: `${stats.projects.active} active`,
      icon: FolderKanban,
      color: "text-primary",
    },
    {
      label: "Services",
      value: stats.services.total,
      subValue: `${stats.services.healthy} healthy`,
      icon: Server,
      color: "text-success",
    },
    {
      label: "Work Items",
      value: stats.workItems.open,
      subValue: `${stats.workItems.inProgress} in progress`,
      icon: CheckCircle,
      color: "text-blue-500",
    },
    {
      label: "Uptime (24h)",
      value: stats.monitoring.uptime !== null ? `${stats.monitoring.uptime}%` : "—",
      subValue:
        stats.monitoring.uptime !== null
          ? `${stats.monitoring.alerts} alert${stats.monitoring.alerts !== 1 ? "s" : ""}`
          : "No checks configured",
      icon: AlertTriangle,
      color: stats.monitoring.alerts > 0 ? "text-warning" : "text-success",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.subValue}</p>
              </div>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
