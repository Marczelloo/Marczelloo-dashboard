"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { DeployAllButton } from "@/components/features/deploy-all-button";
import { GitHubTabs } from "./github-tabs";
import { GitHubInfo } from "./github-info";
import { BranchStatus } from "./branch-status";
import { ReadmeViewer } from "./readme-viewer";
import { FileBrowser } from "./file-browser";
import { DependenciesViewer } from "./dependencies-viewer";
import { SecurityDashboard } from "./security-dashboard";
import { ChangelogViewer } from "./changelog-viewer";
import { ReleaseCreator } from "./release-creator";
import {
  Server,
  CheckSquare,
  Plus,
  Github,
  FolderTree,
  Shield,
  Settings,
  Code2,
  FileText,
  Rocket,
  ExternalLink,
  Activity,
} from "lucide-react";
import type { Service, WorkItem, Deploy, Project } from "@/types";

// ============================================================================
// Types
// ============================================================================

interface ProjectDetailTabsProps {
  project: Project;
  services: Service[];
  workItems: WorkItem[];
  deploys: Deploy[];
}

type TabId = "overview" | "github" | "repository" | "security" | "settings";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const TABS: Tab[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <Activity className="h-4 w-4" />,
    description: "Services, deploys & tasks",
  },
  { id: "github", label: "GitHub", icon: <Github className="h-4 w-4" />, description: "Activity & workflows" },
  {
    id: "repository",
    label: "Repository",
    icon: <FolderTree className="h-4 w-4" />,
    description: "Files & dependencies",
  },
  { id: "security", label: "Security", icon: <Shield className="h-4 w-4" />, description: "Alerts & changelog" },
  { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, description: "Project configuration" },
];

const TYPE_ICONS = {
  todo: "📋",
  bug: "🐛",
  feature: "✨",
  change: "🔄",
} as const;

const PRIORITY_COLORS = {
  low: "secondary",
  medium: "default",
  high: "warning",
  critical: "danger",
} as const;

const TYPE_COLORS = {
  docker: "default",
  vercel: "secondary",
  external: "outline",
} as const;

// ============================================================================
// Tech Info
// ============================================================================

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

// ============================================================================
// Utilities
// ============================================================================

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

function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectDetailTabs({ project, services, workItems, deploys }: ProjectDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-secondary/30 rounded-xl border border-border/50 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-background border border-border rounded-lg shadow-sm"
                transition={{ type: "spring", duration: 0.3 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "overview" && (
            <OverviewTab project={project} services={services} workItems={workItems} deploys={deploys} />
          )}
          {activeTab === "github" && <GitHubTab project={project} />}
          {activeTab === "repository" && <RepositoryTab project={project} />}
          {activeTab === "security" && <SecurityTab project={project} />}
          {activeTab === "settings" && <SettingsTab project={project} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({
  project,
  services,
  workItems,
  deploys,
}: {
  project: Project;
  services: Service[];
  workItems: WorkItem[];
  deploys: Deploy[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Services */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              Services ({services.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <DeployAllButton
                services={services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  type: s.type,
                  deploy_strategy: s.deploy_strategy,
                }))}
                projectId={project.id}
              />
              <Link href={`/projects/${project.id}/services/new`}>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No services yet. Add a service to track containers, websites, or deployments.
              </p>
            ) : (
              <div className="space-y-2">
                {services.map((service) => (
                  <Link key={service.id} href={`/projects/${project.id}/services/${service.id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        <div>
                          <p className="font-medium text-sm">{service.name}</p>
                          {service.url && (
                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{service.url}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={TYPE_COLORS[service.type] || "secondary"}>{service.type}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deploys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Recent Deploys
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deploys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No deployments yet</p>
            ) : (
              <div className="space-y-2">
                {deploys.slice(0, 5).map((deploy) => {
                  const service = services.find((s) => s.id === deploy.service_id);
                  return (
                    <div
                      key={deploy.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            deploy.status === "success"
                              ? "bg-success"
                              : deploy.status === "failed"
                                ? "bg-destructive"
                                : "bg-warning"
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium">{service?.name || "Unknown Service"}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(deploy.started_at)}</p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          deploy.status === "success" ? "success" : deploy.status === "failed" ? "danger" : "warning"
                        }
                      >
                        {deploy.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Work Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <Link href={`/projects/${project.id}/work-items`} className="hover:opacity-80 transition-opacity">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Work Items ({workItems.length})
              </CardTitle>
            </Link>
            <Link href={`/projects/${project.id}/work-items/new`}>
              <Button variant="ghost" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {workItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No open work items</p>
            ) : (
              <div className="space-y-2">
                {workItems.slice(0, 5).map((item) => (
                  <Link key={item.id} href={`/projects/${project.id}/work-items/${item.id}`}>
                    <div className="flex items-start gap-2 rounded-lg p-2 hover:bg-secondary/30 transition-colors">
                      <span className="mt-0.5">{TYPE_ICONS[item.type] || "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <Badge variant={PRIORITY_COLORS[item.priority]} className="text-xs mt-1">
                          {item.priority}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
                {workItems.length > 5 && (
                  <Link
                    href={`/projects/${project.id}/work-items`}
                    className="block text-center text-sm text-primary hover:underline pt-2"
                  >
                    View all {workItems.length} items →
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-secondary/30">
              <p className="text-2xl font-bold text-primary">{services.length}</p>
              <p className="text-xs text-muted-foreground">Services</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/30">
              <p className="text-2xl font-bold text-primary">{workItems.length}</p>
              <p className="text-xs text-muted-foreground">Open Tasks</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/30">
              <p className="text-2xl font-bold text-success">{deploys.filter((d) => d.status === "success").length}</p>
              <p className="text-xs text-muted-foreground">Successful</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/30">
              <p className="text-2xl font-bold text-destructive">
                {deploys.filter((d) => d.status === "failed").length}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// GitHub Tab
// ============================================================================

function GitHubTab({ project }: { project: Project }) {
  if (!project.github_url) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Github className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No GitHub repository linked to this project.</p>
          <Link href={`/projects/${project.id}/edit`}>
            <Button variant="outline" size="sm" className="mt-4">
              Link Repository
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Runs */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GitHubTabs githubUrl={project.github_url} />
        </div>
        <div className="space-y-6">
          <GitHubInfo githubUrl={project.github_url} />
          <BranchStatus githubUrl={project.github_url} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Repository Tab
// ============================================================================

function RepositoryTab({ project }: { project: Project }) {
  if (!project.github_url) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FolderTree className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No GitHub repository linked to this project.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <ReadmeViewer githubUrl={project.github_url} />
      </div>
      <div className="space-y-6">
        <FileBrowser githubUrl={project.github_url} />
        <DependenciesViewer githubUrl={project.github_url} />
      </div>
    </div>
  );
}

// ============================================================================
// Security Tab
// ============================================================================

function SecurityTab({ project }: { project: Project }) {
  if (!project.github_url) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No GitHub repository linked to this project.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SecurityDashboard githubUrl={project.github_url} />
      <ChangelogViewer githubUrl={project.github_url} />
    </div>
  );
}

// ============================================================================
// Settings Tab
// ============================================================================

function SettingsTab({ project }: { project: Project }) {
  const technologies = parseArray(project.technologies);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Technologies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Technologies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {technologies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No technologies specified.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {technologies.map((tech) => {
                const key = tech.toLowerCase().replace(/[\s.]/g, "");
                const info = TECH_INFO[key] || TECH_INFO[tech.toLowerCase()];
                return (
                  <a
                    key={tech}
                    href={info?.doc || `https://google.com/search?q=${encodeURIComponent(tech + " documentation")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                    title={`${info?.label || tech} Documentation`}
                  >
                    <span>{info?.emoji || "📦"}</span>
                    <span>{info?.label || tech}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Project Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={
                  project.status === "active" ? "success" : project.status === "maintenance" ? "warning" : "secondary"
                }
              >
                {project.status}
              </Badge>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDateTime(project.created_at)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Updated</span>
              <span>{formatRelativeTime(project.updated_at)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs">{project.id}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">/{project.slug}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Link href={`/projects/${project.id}/edit`} className="flex-1">
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4" />
                Edit Project
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {project.notes && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Release Creator */}
      {project.github_url && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Create Release
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReleaseCreator githubUrl={project.github_url} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
