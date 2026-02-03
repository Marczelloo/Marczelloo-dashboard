import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Deploy, Service } from "@/types";
import { deploys as deploysRepo, services as servicesRepo } from "@/server/atlashub";

interface RecentDeploysProps {
  deploys: Deploy[];
  services: Service[];
}

function getStatusBadge(status: Deploy["status"]) {
  switch (status) {
    case "success":
      return (
        <Badge variant="secondary" className="bg-success/20 text-success border-success/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="secondary" className="bg-danger/20 text-danger border-danger/30">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getDuration(deploy: Deploy): string {
  if (!deploy.finished_at) {
    return formatDistanceToNow(new Date(deploy.started_at), { addSuffix: false, includeSeconds: true });
  }

  const start = new Date(deploy.started_at).getTime();
  const end = new Date(deploy.finished_at).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) return "<1s";
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
  return `${Math.round(durationMs / 3600000)}h`;
}

function RecentDeploysUI({ deploys, services }: RecentDeploysProps) {
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  if (deploys.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Recent Deployments
          </CardTitle>
          <CardDescription>Latest deployment activity across all services</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No deployments yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Recent Deployments
        </CardTitle>
        <CardDescription>Latest deployment activity across all services</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deploys.map((deploy) => {
            const service = serviceMap.get(deploy.service_id);
            return (
              <div
                key={deploy.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusBadge(deploy.status)}
                  <div>
                    <p className="font-medium text-sm">{service?.name || "Unknown Service"}</p>
                    <p className="text-xs text-muted-foreground">
                      by {deploy.triggered_by} • {formatDistanceToNow(new Date(deploy.started_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-muted-foreground">{getDuration(deploy)}</p>
                  {deploy.commit_sha && (
                    <p className="text-xs font-mono text-muted-foreground">{deploy.commit_sha.substring(0, 7)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Server component that fetches data
export async function RecentDeploysServer() {
  const [recentDeploys, allServices] = await Promise.all([
    deploysRepo.getRecentDeploys(10),
    servicesRepo.getServices(),
  ]);

  return <RecentDeploysUI deploys={recentDeploys} services={allServices} />;
}
