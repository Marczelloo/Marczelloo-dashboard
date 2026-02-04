import { Suspense } from "react";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
import { Header } from "@/components/layout";
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import { RefreshCw, AlertTriangle, Server } from "lucide-react";
import * as portainer from "@/server/portainer/client";
import type { PortainerContainer, PortainerEndpoint } from "@/types";
import { ContainerActions } from "./_components/container-actions";

async function refreshContainers() {
  "use server";
  revalidatePath("/containers");
}

export default function ContainersPage() {
  return (
    <>
      <Header title="Containers" description="Docker container management via Portainer">
        <form action={refreshContainers}>
          <Button variant="outline" size="sm" type="submit">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </form>
      </Header>

      <div className="p-6">
        <Suspense fallback={<ContainersListSkeleton />}>
          <ContainersList />
        </Suspense>
      </div>
    </>
  );
}

async function ContainersList() {
  let endpoints: PortainerEndpoint[] = [];
  let error: string | null = null;

  try {
    endpoints = await portainer.getEndpoints();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to connect to Portainer";
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-danger" />
          <p className="text-danger font-medium mb-2">Failed to connect to Portainer</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-muted-foreground text-sm mt-4">
            Check that Portainer is running and PORTAINER_URL / PORTAINER_TOKEN are correct.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (endpoints.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No Docker endpoints found in Portainer.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Add a Docker environment in Portainer to manage containers.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get containers from all endpoints
  const containersPromises = endpoints.map(async (endpoint) => {
    try {
      const containers = await portainer.getContainers(endpoint.Id, true);
      return { endpoint, containers, error: null };
    } catch (e) {
      return { endpoint, containers: [], error: e instanceof Error ? e.message : "Failed to fetch" };
    }
  });

  const results = await Promise.all(containersPromises);

  return (
    <div className="space-y-8">
      {results.map(({ endpoint, containers, error }) => (
        <div key={endpoint.Id} className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{endpoint.Name}</h2>
            <Badge variant="secondary">{containers.length} containers</Badge>
          </div>

          {error ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-danger">{error}</p>
              </CardContent>
            </Card>
          ) : containers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No containers on this endpoint.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {containers.map((container) => (
                <ContainerCard key={container.Id} container={container} endpointId={endpoint.Id} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ContainerCard({ container, endpointId }: { container: PortainerContainer; endpointId: number }) {
  const status = portainer.getContainerStatus(container);
  const name = container.Names[0]?.replace(/^\//, "") ?? container.Id.slice(0, 12);
  const ports =
    container.Ports?.filter((p) => p.PublicPort)
      .map((p) => `${p.PublicPort}:${p.PrivatePort}`)
      .join(", ") || "";

  return (
    <Card className="card-hover">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <StatusDot
              status={status === "running" ? "online" : status === "unhealthy" ? "warning" : "offline"}
              size="lg"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{name}</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {container.Id.slice(0, 12)}
                </Badge>
                {status === "unhealthy" && (
                  <Badge variant="warning" className="text-xs">
                    Unhealthy
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{container.Image}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm">{container.Status}</p>
              {ports && <p className="text-xs text-muted-foreground font-mono">{ports}</p>}
            </div>

            <ContainerActions containerId={container.Id} endpointId={endpointId} status={status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContainersListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  );
}
