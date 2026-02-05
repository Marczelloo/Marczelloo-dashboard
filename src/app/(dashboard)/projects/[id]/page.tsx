import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Badge, Button } from "@/components/ui";
import { DeployProjectButton } from "@/components/features/deploy-project-button";
import { ProjectDetailTabs } from "./_components/project-detail-tabs";
import { projects, services, workItems, deploys } from "@/server/data";
import { Github, ExternalLink, Globe, Settings, ArrowLeft } from "lucide-react";
import type { Deploy } from "@/types";

export const dynamic = "force-dynamic";

// Helper to parse tags/technologies which may come as JSON string or array
function parseArray(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await projects.getProjectById(id);

  if (!project) {
    notFound();
  }

  // Fetch all data in parallel
  const [projectServices, openWorkItems, serviceIds] = await Promise.all([
    services.getServicesByProjectId(id),
    workItems.getOpenWorkItemsByProjectId(id),
    services.getServicesByProjectId(id).then((s) => s.map((srv) => srv.id)),
  ]);

  // Get recent deploys for all services
  let recentDeploys: Deploy[] = [];
  for (const serviceId of serviceIds.slice(0, 5)) {
    const serviceDeploys = await deploys.getDeploysByServiceId(serviceId);
    recentDeploys = [...recentDeploys, ...serviceDeploys.slice(0, 3)];
  }

  // Sort by date and take latest 10
  recentDeploys = recentDeploys
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 10);

  return (
    <>
      <Header title={project.name} description={project.description || `/${project.slug}`}>
        <div className="flex items-center gap-2">
          <PageInfoButton {...PAGE_INFO.projectDetail} />
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <DeployProjectButton projectId={id} projectName={project.name} githubUrl={project.github_url} />
          <Link href={`/projects/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </Header>

      <div className="p-6 space-y-6">
        {/* Project Info Bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-secondary/20 border border-border/50">
          <Badge
            variant={
              project.status === "active" ? "success" : project.status === "maintenance" ? "warning" : "secondary"
            }
            className="text-sm"
          >
            {project.status}
          </Badge>

          {parseArray(project.tags).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}

          <div className="flex items-center gap-4 ml-auto">
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            )}
            {project.prod_url && (
              <a
                href={project.prod_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Production</span>
              </a>
            )}
            {project.vercel_url && (
              <a
                href={project.vercel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Vercel</span>
              </a>
            )}
          </div>
        </div>

        {/* Tab Interface */}
        <ProjectDetailTabs
          project={project}
          services={projectServices}
          workItems={openWorkItems}
          deploys={recentDeploys}
        />
      </div>
    </>
  );
}
