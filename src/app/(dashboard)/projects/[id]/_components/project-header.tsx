"use client";

import Link from "next/link";
import { ExternalLink, Github, MoreHorizontal, Settings } from "lucide-react";
import { DeployProjectButton } from "@/components/features/deploy-project-button";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/utils";
import type { ProjectDetail } from "@/server/projects/detail";

const repoLabel = (url: string) => url.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");

export function ProjectHeader({ detail }: { detail: ProjectDetail }) {
  const { project, domain, tone, deploys } = detail;
  const last = deploys[0];
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold leading-tight tracking-[-0.02em]">
          <StatusDot status={tone} size="lg" label={detail.attention ? detail.attention.kind : "healthy"} />
          <span className="truncate">{project.name}</span>
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
          {domain && (
            <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-fg-2 hover:text-fg">
              {domain}
              <ExternalLink className="size-3" strokeWidth={1.75} />
            </a>
          )}
          {project.github_url && (
            <a href={project.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono hover:text-fg">
              <Github className="size-3" strokeWidth={1.75} />
              {repoLabel(project.github_url)}
            </a>
          )}
          <span>
            {last ? (
              <>
                last deploy {formatRelativeTime(last.started_at)}
                {last.commit_sha && <code className="ml-1.5 text-fg-2">{last.commit_sha.slice(0, 7)}</code>}
              </>
            ) : (
              "never deployed"
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DeployProjectButton projectId={project.id} projectName={project.name} githubUrl={project.github_url} />
        {domain && (
          <Button variant="secondary" size="default" asChild>
            <a href={`https://${domain}`} target="_blank" rel="noreferrer">
              <ExternalLink strokeWidth={1.75} />
              Open
            </a>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="More project actions">
              <MoreHorizontal strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/projects/${project.id}?tab=settings`}>
                <Settings strokeWidth={1.75} />
                Project settings
              </Link>
            </DropdownMenuItem>
            {project.github_url && (
              <DropdownMenuItem asChild>
                <a href={project.github_url} target="_blank" rel="noreferrer">
                  <Github strokeWidth={1.75} />
                  Open repository
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
