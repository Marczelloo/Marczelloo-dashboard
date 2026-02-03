import Link from "next/link";
import { projects, services, workItems } from "@/server/atlashub";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import { Github, ExternalLink, Server, CheckSquare } from "lucide-react";
import type { Project } from "@/types";

// Helper to parse tags which may come as JSON string or array
function parseTags(tags: string | string[] | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const statusColors = {
  active: "success",
  inactive: "secondary",
  archived: "outline",
  maintenance: "warning",
} as const;

export async function ProjectsList() {
  const allProjects = await projects.getProjects();

  if (allProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-secondary p-4">
          <Server className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No projects yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Create your first project to get started</p>
        <Link href="/projects/new" className="mt-4 text-sm font-medium text-primary hover:underline">
          Create a project →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {allProjects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

async function ProjectCard({ project }: { project: Project }) {
  const [projectServices, projectWorkItems] = await Promise.all([
    services.getServicesByProjectId(project.id),
    workItems.getOpenWorkItemsByProjectId(project.id),
  ]);

  const healthyServices = projectServices.filter(() => true); // TODO: Check actual health

  return (
    <Card className="card-hover h-full relative">
      <Link href={`/projects/${project.id}`} className="absolute inset-0 z-0" />
      <CardHeader className="pb-3 relative z-10 pointer-events-none">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{project.name}</CardTitle>
            <p className="text-xs text-muted-foreground">/{project.slug}</p>
          </div>
          <Badge variant={statusColors[project.status]}>{project.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10 pointer-events-none">
        {project.description && <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {healthyServices.length}/{projectServices.length} services
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{projectWorkItems.length} open</span>
          </div>
        </div>

        {/* Tags */}
        {(() => {
          const tags = parseTags(project.tags);
          if (tags.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          );
        })()}

        {/* Links - pointer-events-auto to make clickable above the overlay */}
        <div className="flex items-center gap-3 pt-2 border-t border-border pointer-events-auto">
          {project.github_url && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <Github className="h-4 w-4" />
            </a>
          )}
          {project.prod_url && (
            <a
              href={project.prod_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <span className="ml-auto text-xs text-muted-foreground pointer-events-none">
            Updated {formatRelativeTime(project.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
