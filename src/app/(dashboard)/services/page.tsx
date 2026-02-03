import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent, Skeleton, Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { getStandaloneServices, getProjectBoundServices } from "@/server/atlashub/services";
import { getProjects } from "@/server/atlashub/projects";
import { Plus, Server, ExternalLink, FolderKanban } from "lucide-react";
import type { Service, Project } from "@/types";

// Force dynamic rendering (no static prerendering)
export const dynamic = "force-dynamic";

function ServiceCard({ service, project }: { service: Service; project?: Project }) {
  const typeColors: Record<string, string> = {
    docker: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    vercel: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    external: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
              {project && (
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <FolderKanban className="h-3 w-3" />
                  {project.name}
                </Link>
              )}
              {!project && <span className="text-xs text-muted-foreground">Standalone service</span>}
            </div>
          </div>
          <Badge variant="outline" className={typeColors[service.type] || ""}>
            {service.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {service.url ? (
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {new URL(service.url).hostname}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">No URL configured</span>
          )}
          <Link href={`/services/${service.id}`}>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

async function ServicesContent() {
  const [standaloneServices, projectBoundServices, projects] = await Promise.all([
    getStandaloneServices(),
    getProjectBoundServices(),
    getProjects(),
  ]);

  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]));

  const hasAnyServices = standaloneServices.length > 0 || projectBoundServices.length > 0;

  if (!hasAnyServices) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No services configured yet.</p>
        <p className="mt-2 text-sm">Create a standalone service or add services to your projects.</p>
        <Link href="/services/new" className="mt-4 inline-block">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Service
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Standalone Services */}
      {standaloneServices.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Standalone Services</h2>
              <p className="text-sm text-muted-foreground">
                Infrastructure services like Portainer, databases, and other tools
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {standaloneServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>
      )}

      {/* Project-Bound Services */}
      {projectBoundServices.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Project Services</h2>
              <p className="text-sm text-muted-foreground">Services attached to specific projects</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectBoundServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                project={service.project_id ? projectMap.get(service.project_id) : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ServicesPage() {
  return (
    <>
      <Header title="Services" description="All services across your infrastructure">
        <Link href="/services/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Service
          </Button>
        </Link>
      </Header>

      <div className="p-6">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          }
        >
          <ServicesContent />
        </Suspense>
      </div>
    </>
  );
}
