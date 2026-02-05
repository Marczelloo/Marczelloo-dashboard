"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import { Github, ExternalLink, Server, CheckSquare, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

const PINNED_PROJECTS_KEY = "marczelloo_pinned_projects";

interface ProjectWithStats extends Project {
  servicesCount: number;
  healthyServicesCount: number;
  openWorkItemsCount: number;
}

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

interface ProjectsListClientProps {
  projects: ProjectWithStats[];
}

export function ProjectsListClient({ projects }: ProjectsListClientProps) {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Load pinned projects from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_PROJECTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPinnedIds(new Set(parsed));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save pinned projects to localStorage
  const savePinnedIds = (ids: Set<string>) => {
    try {
      localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify([...ids]));
    } catch {
      // Ignore localStorage errors
    }
  };

  const togglePin = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      savePinnedIds(next);
      return next;
    });
  };

  // Sort projects: pinned first, then by updated_at
  const sortedProjects = [...projects].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);

    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const pinnedCount = [...pinnedIds].filter((id) => projects.some((p) => p.id === id)).length;

  if (projects.length === 0) {
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
    <div className="space-y-6">
      {pinnedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Pin className="h-4 w-4 text-primary" />
          <span>
            {pinnedCount} pinned project{pinnedCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isPinned={pinnedIds.has(project.id)}
            onTogglePin={togglePin}
          />
        ))}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectWithStats;
  isPinned: boolean;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
}

function ProjectCard({ project, isPinned, onTogglePin }: ProjectCardProps) {
  return (
    <Card
      className={cn("card-hover h-full relative transition-all", isPinned && "ring-2 ring-primary/30 bg-primary/5")}
    >
      <Link href={`/projects/${project.id}`} className="absolute inset-0 z-0" />
      <CardHeader className="pb-3 relative z-10 pointer-events-none">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isPinned && <Pin className="h-3.5 w-3.5 text-primary" />}
              <CardTitle className="text-base">{project.name}</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">/{project.slug}</p>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                isPinned ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => onTogglePin(project.id, e)}
              title={isPinned ? "Unpin project" : "Pin project"}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Badge variant={statusColors[project.status]}>{project.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10 pointer-events-none">
        {project.description && <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {project.healthyServicesCount}/{project.servicesCount} services
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{project.openWorkItemsCount} open</span>
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
