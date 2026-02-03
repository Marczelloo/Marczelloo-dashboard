import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { services, projects, uptimeChecks } from "@/server/atlashub";
import { formatRelativeTime } from "@/lib/utils";
import type { Service, Project } from "@/types";

interface ServiceStatusItem {
  id: string;
  name: string;
  projectName: string;
  type: "docker" | "vercel" | "external";
  status: "online" | "warning" | "offline" | "unknown";
  latency: number | null;
  lastCheck: string;
  url: string | null;
}

async function getServiceStatuses(): Promise<ServiceStatusItem[]> {
  const [allServices, allProjects] = await Promise.all([services.getServices({ limit: 10 }), projects.getProjects()]);

  const projectMap = new Map(allProjects.map((p: Project) => [p.id, p.name]));

  // Fetch uptime stats for services with URLs
  const serviceStatuses = await Promise.all(
    allServices.map(async (service: Service) => {
      let status: "online" | "warning" | "offline" | "unknown" = "unknown";
      let latency: number | null = null;
      let lastCheck = "—";

      if (service.url) {
        const stats = await uptimeChecks.getUptimeStats(service.id, 24);
        const latest = await uptimeChecks.getLatestCheckByServiceId(service.id);

        if (stats.checks > 0) {
          status = stats.lastOk ? "online" : "offline";
          if (stats.uptime < 100 && stats.uptime > 0) {
            status = "warning";
          }
          latency = Math.round(stats.avgLatency);
        }

        if (latest?.checked_at) {
          lastCheck = formatRelativeTime(latest.checked_at);
        }
      }

      return {
        id: service.id,
        name: service.name,
        projectName: service.project_id ? projectMap.get(service.project_id) || "Unknown" : "Standalone",
        type: service.type as "docker" | "vercel" | "external",
        status,
        latency,
        lastCheck,
        url: service.url,
      };
    })
  );

  return serviceStatuses;
}

const typeColors = {
  docker: "secondary",
  vercel: "outline",
  external: "outline",
} as const;

export async function ServiceStatus() {
  const servicesList = await getServiceStatuses();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Service Status</CardTitle>
        <Link href="/monitoring" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {servicesList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No services yet. Create a project and add services to monitor.
          </p>
        ) : (
          <div className="space-y-4">
            {servicesList.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <StatusDot status={service.status} size="lg" pulse={service.status === "warning"} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{service.name}</span>
                      <Badge variant={typeColors[service.type]}>{service.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{service.projectName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm">{service.latency !== null ? `${service.latency}ms` : "—"}</p>
                    <p className="text-xs text-muted-foreground">{service.lastCheck}</p>
                  </div>

                  {service.url && (
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
