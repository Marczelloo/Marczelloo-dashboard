import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton } from "@/components/ui";
import { DeployAllButton } from "@/components/features/deploy-all-button";
import { DeployProjectButton } from "@/components/features/deploy-project-button";
import { projects, services, workItems, deploys } from "@/server/atlashub";
import { formatRelativeTime, formatDateTime } from "@/lib/utils";
import { Github, ExternalLink, Globe, Settings, Plus, Server, CheckSquare, ArrowLeft, Code2 } from "lucide-react";
import type { Service, Deploy } from "@/types";

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

// Technology information with icons and documentation links
const TECH_INFO: Record<string, { emoji: string; doc: string; label?: string }> = {
  nextjs: { emoji: "▲", doc: "https://nextjs.org/docs", label: "Next.js" },
  "next.js": { emoji: "▲", doc: "https://nextjs.org/docs", label: "Next.js" },
  react: { emoji: "⚛️", doc: "https://react.dev", label: "React" },
  typescript: { emoji: "📘", doc: "https://typescriptlang.org/docs", label: "TypeScript" },
  javascript: { emoji: "📙", doc: "https://developer.mozilla.org/en-US/docs/Web/JavaScript", label: "JavaScript" },
  tailwindcss: { emoji: "🎨", doc: "https://tailwindcss.com/docs", label: "Tailwind CSS" },
  tailwind: { emoji: "🎨", doc: "https://tailwindcss.com/docs", label: "Tailwind CSS" },
  nodejs: { emoji: "🟢", doc: "https://nodejs.org/docs", label: "Node.js" },
  "node.js": { emoji: "🟢", doc: "https://nodejs.org/docs", label: "Node.js" },
  node: { emoji: "🟢", doc: "https://nodejs.org/docs", label: "Node.js" },
  docker: { emoji: "🐳", doc: "https://docs.docker.com", label: "Docker" },
  python: { emoji: "🐍", doc: "https://docs.python.org/3/", label: "Python" },
  postgresql: { emoji: "🐘", doc: "https://postgresql.org/docs/", label: "PostgreSQL" },
  postgres: { emoji: "🐘", doc: "https://postgresql.org/docs/", label: "PostgreSQL" },
  mysql: { emoji: "🐬", doc: "https://dev.mysql.com/doc/", label: "MySQL" },
  mongodb: { emoji: "🍃", doc: "https://docs.mongodb.com/", label: "MongoDB" },
  redis: { emoji: "🔴", doc: "https://redis.io/docs/", label: "Redis" },
  graphql: { emoji: "◆", doc: "https://graphql.org/learn/", label: "GraphQL" },
  prisma: { emoji: "△", doc: "https://prisma.io/docs", label: "Prisma" },
  drizzle: { emoji: "💧", doc: "https://orm.drizzle.team/docs", label: "Drizzle" },
  vue: { emoji: "💚", doc: "https://vuejs.org/guide/", label: "Vue.js" },
  angular: { emoji: "🅰️", doc: "https://angular.io/docs", label: "Angular" },
  svelte: { emoji: "🔥", doc: "https://svelte.dev/docs", label: "Svelte" },
  express: { emoji: "🚂", doc: "https://expressjs.com/", label: "Express" },
  fastify: { emoji: "⚡", doc: "https://fastify.dev/docs/", label: "Fastify" },
  hono: { emoji: "🔥", doc: "https://hono.dev/docs/", label: "Hono" },
  rust: { emoji: "🦀", doc: "https://doc.rust-lang.org/", label: "Rust" },
  go: { emoji: "🐹", doc: "https://go.dev/doc/", label: "Go" },
  golang: { emoji: "🐹", doc: "https://go.dev/doc/", label: "Go" },
  java: { emoji: "☕", doc: "https://docs.oracle.com/javase/", label: "Java" },
  kotlin: { emoji: "🟣", doc: "https://kotlinlang.org/docs/", label: "Kotlin" },
  swift: { emoji: "🍎", doc: "https://swift.org/documentation/", label: "Swift" },
  csharp: { emoji: "💜", doc: "https://docs.microsoft.com/dotnet/csharp/", label: "C#" },
  "c#": { emoji: "💜", doc: "https://docs.microsoft.com/dotnet/csharp/", label: "C#" },
  dotnet: { emoji: "💜", doc: "https://docs.microsoft.com/dotnet/", label: ".NET" },
  ".net": { emoji: "💜", doc: "https://docs.microsoft.com/dotnet/", label: ".NET" },
  aws: { emoji: "☁️", doc: "https://docs.aws.amazon.com/", label: "AWS" },
  gcp: { emoji: "☁️", doc: "https://cloud.google.com/docs", label: "GCP" },
  azure: { emoji: "☁️", doc: "https://docs.microsoft.com/azure/", label: "Azure" },
  vercel: { emoji: "▲", doc: "https://vercel.com/docs", label: "Vercel" },
  cloudflare: { emoji: "🔶", doc: "https://developers.cloudflare.com/", label: "Cloudflare" },
  supabase: { emoji: "⚡", doc: "https://supabase.com/docs", label: "Supabase" },
  firebase: { emoji: "🔥", doc: "https://firebase.google.com/docs", label: "Firebase" },
  strapi: { emoji: "🚀", doc: "https://docs.strapi.io/", label: "Strapi" },
  sanity: { emoji: "📝", doc: "https://www.sanity.io/docs", label: "Sanity" },
  shadcn: { emoji: "🎨", doc: "https://ui.shadcn.com/", label: "shadcn/ui" },
  "framer-motion": { emoji: "🎬", doc: "https://www.framer.com/motion/", label: "Framer Motion" },
  zod: { emoji: "✅", doc: "https://zod.dev/", label: "Zod" },
  trpc: { emoji: "🔗", doc: "https://trpc.io/docs", label: "tRPC" },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await projects.getProjectById(id);

  if (!project) {
    notFound();
  }

  return (
    <>
      <Header title={project.name} description={project.description || `/${project.slug}`}>
        <div className="flex items-center gap-2">
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <DeployProjectButton projectId={id} projectName={project.name} />
          <Link href={`/projects/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </Header>

      <div className="p-6 space-y-6">
        {/* Project Info */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={
              project.status === "active" ? "success" : project.status === "maintenance" ? "warning" : "secondary"
            }
          >
            {project.status}
          </Badge>

          {parseArray(project.tags).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}

          <div className="flex items-center gap-3 ml-auto">
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            )}
            {project.prod_url && (
              <a
                href={project.prod_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Globe className="h-4 w-4" />
                Production
              </a>
            )}
            {project.vercel_url && (
              <a
                href={project.vercel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                Vercel
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Services */}
          <div className="lg:col-span-2 space-y-6">
            <Suspense fallback={<SectionSkeleton title="Services" />}>
              <ServicesSection projectId={id} />
            </Suspense>

            <Suspense fallback={<SectionSkeleton title="Recent Deploys" />}>
              <DeploysSection projectId={id} />
            </Suspense>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Suspense fallback={<SectionSkeleton title="Work Items" />}>
              <WorkItemsSection projectId={id} />
            </Suspense>

            {/* Technologies */}
            {parseArray(project.technologies).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code2 className="h-4 w-4" />
                    Technologies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {parseArray(project.technologies).map((tech) => {
                      const key = tech.toLowerCase().replace(/[\s.]/g, "");
                      const info = TECH_INFO[key] || TECH_INFO[tech.toLowerCase()];
                      return (
                        <a
                          key={tech}
                          href={
                            info?.doc || `https://google.com/search?q=${encodeURIComponent(tech + " documentation")}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-sm hover:bg-secondary transition-colors"
                          title={`${info?.label || tech} Documentation`}
                        >
                          <span>{info?.emoji || "📦"}</span>
                          <span>{info?.label || tech}</span>
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {project.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDateTime(project.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{formatRelativeTime(project.updated_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-xs">{project.id.slice(0, 8)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

async function ServicesSection({ projectId }: { projectId: string }) {
  const projectServices = await services.getServicesByProjectId(projectId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Server className="h-4 w-4" />
          Services ({projectServices.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <DeployAllButton
            services={projectServices.map((s) => ({
              id: s.id,
              name: s.name,
              type: s.type,
              deploy_strategy: s.deploy_strategy,
            }))}
            projectId={projectId}
          />
          <Link href={`/projects/${projectId}/services/new`}>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {projectServices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No services yet. Add a service to track containers, websites, or deployments.
          </p>
        ) : (
          <div className="space-y-3">
            {projectServices.map((service) => (
              <ServiceRow key={service.id} service={service} projectId={projectId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceRow({ service, projectId }: { service: Service; projectId: string }) {
  const typeColors = {
    docker: "default",
    vercel: "secondary",
    external: "outline",
  } as const;

  return (
    <Link href={`/projects/${projectId}/services/${service.id}`}>
      <div className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-success" />
          <div>
            <p className="font-medium text-sm">{service.name}</p>
            {service.url && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{service.url}</p>}
          </div>
        </div>
        <Badge variant={typeColors[service.type] || "secondary"}>{service.type}</Badge>
      </div>
    </Link>
  );
}

async function WorkItemsSection({ projectId }: { projectId: string }) {
  const openItems = await workItems.getOpenWorkItemsByProjectId(projectId);

  const typeIcons = {
    todo: "📋",
    bug: "🐛",
    feature: "✨",
    change: "🔄",
  };

  const priorityColors = {
    low: "secondary",
    medium: "default",
    high: "warning",
    critical: "danger",
  } as const;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Link href={`/projects/${projectId}/work-items`} className="hover:opacity-80 transition-opacity">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Work Items ({openItems.length})
            <span className="text-xs text-muted-foreground font-normal ml-1">View all →</span>
          </CardTitle>
        </Link>
        <Link href={`/projects/${projectId}/work-items/new`}>
          <Button variant="ghost" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {openItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No open work items</p>
        ) : (
          <div className="space-y-2">
            {openItems.slice(0, 5).map((item) => (
              <Link key={item.id} href={`/projects/${projectId}/work-items/${item.id}`}>
                <div className="flex items-start gap-2 rounded p-2 hover:bg-secondary/50 transition-colors">
                  <span>{typeIcons[item.type] || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={priorityColors[item.priority]} className="text-xs">
                        {item.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {openItems.length > 5 && (
              <Link
                href={`/projects/${projectId}/work-items`}
                className="block text-center text-sm text-primary hover:underline pt-2"
              >
                View all {openItems.length} items →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function DeploysSection({ projectId }: { projectId: string }) {
  const { ProjectDeploysClient } = await import("./_components/project-deploys");

  const projectServices = await services.getServicesByProjectId(projectId);
  const serviceIds = projectServices.map((s) => s.id);

  // Get recent deploys for all services
  let recentDeploys: Deploy[] = [];
  for (const serviceId of serviceIds.slice(0, 5)) {
    const serviceDeploys = await deploys.getDeploysByServiceId(serviceId);
    recentDeploys = [...recentDeploys, ...serviceDeploys.slice(0, 3)];
  }

  // Sort by date and take latest 5
  recentDeploys = recentDeploys
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 5);

  return <ProjectDeploysClient deploys={recentDeploys} services={projectServices} />;
}

function SectionSkeleton({ title: _title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
