import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import { ExternalLink, Container } from "lucide-react";
import Link from "next/link";
import { services, projects, uptimeChecks } from "@/server/atlashub";
import { formatRelativeTime } from "@/lib/utils";
import { getContainers, getContainerStatus } from "@/server/portainer/client";
import type { Service, Project, PortainerContainer } from "@/types";

interface ServiceStatusItem {
  id: string;
  name: string;
  projectName: string;
  type: "docker" | "vercel" | "external";
  status: "online" | "warning" | "offline" | "unknown";
  // For websites
  latency: number | null;
  lastCheck: string;
  url: string | null;
  // For Docker containers
  containerState: string | null;
  containerUptime: string | null;
}

function formatContainerUptime(startedAt: number | undefined): string {
  if (!startedAt || startedAt === 0) return "—";

  const now = Date.now() / 1000;
  const uptimeSeconds = now - startedAt;

  if (uptimeSeconds < 60) return `${Math.floor(uptimeSeconds)}s`;
  if (uptimeSeconds < 3600) return `${Math.floor(uptimeSeconds / 60)}m`;
  if (uptimeSeconds < 86400) return `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;

  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

async function getServiceStatuses(): Promise<ServiceStatusItem[]> {
  const [allServices, allProjects] = await Promise.all([services.getServices({ limit: 10 }), projects.getProjects()]);

  const projectMap = new Map(allProjects.map((p: Project) => [p.id, p.name]));

  // Fetch container data from Portainer for Docker services
  const containersMap = new Map<string, PortainerContainer>();
  const dockerServices = allServices.filter(
    (s: Service) => s.type === "docker" && s.container_id && s.portainer_endpoint_id
  );

  if (dockerServices.length > 0) {
    // Get unique endpoint IDs
    const endpointIds = [...new Set(dockerServices.map((s: Service) => s.portainer_endpoint_id!))];

    try {
      // Fetch containers from all endpoints in parallel
      const containerResults = await Promise.all(endpointIds.map((endpointId) => getContainers(endpointId, true)));

      // Build container map
      for (const containers of containerResults) {
        for (const container of containers) {
          containersMap.set(container.Id, container);
          // Also map by short ID (first 12 chars)
          if (container.Id.length > 12) {
            containersMap.set(container.Id.substring(0, 12), container);
          }
          // Map by container name (without leading /)
          for (const name of container.Names) {
            containersMap.set(name.replace(/^\//, ""), container);
          }
        }
      }
    } catch (error) {
      console.error("[ServiceStatus] Failed to fetch containers:", error);
    }
  }

  // Fetch uptime stats for services with URLs
  const serviceStatuses = await Promise.all(
    allServices.map(async (service: Service) => {
      let status: "online" | "warning" | "offline" | "unknown" = "unknown";
      let latency: number | null = null;
      let lastCheck = "—";
      let containerState: string | null = null;
      let containerUptime: string | null = null;

      // Docker container monitoring
      if (service.type === "docker" && service.container_id) {
        const container = containersMap.get(service.container_id);

        if (container) {
          const containerStatus = getContainerStatus(container);
          containerState = container.State;

          switch (containerStatus) {
            case "running":
              status = "online";
              containerUptime = formatContainerUptime(container.Created);
              break;
            case "unhealthy":
              status = "warning";
              containerUptime = formatContainerUptime(container.Created);
              break;
            case "stopped":
              status = "offline";
              break;
            default:
              status = "unknown";
          }
        } else {
          status = "unknown";
          containerState = "not found";
        }
      }
      // Website/URL monitoring
      else if (service.url) {
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
        containerState,
        containerUptime,
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
                  {/* Docker container metrics */}
                  {service.type === "docker" && service.containerState !== null ? (
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Container className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm capitalize">{service.containerState}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {service.containerUptime ? `Up ${service.containerUptime}` : "—"}
                      </p>
                    </div>
                  ) : (
                    /* Website metrics */
                    <div className="text-right">
                      <p className="text-sm">{service.latency !== null ? `${service.latency}ms` : "—"}</p>
                      <p className="text-xs text-muted-foreground">{service.lastCheck}</p>
                    </div>
                  )}

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
