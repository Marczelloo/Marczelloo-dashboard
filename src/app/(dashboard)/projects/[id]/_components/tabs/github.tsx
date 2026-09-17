import Link from "next/link";
import { Github } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import type { Project } from "@/types";
import { BranchStatus } from "../branch-status";
import { GitHubInfo } from "../github-info";
import { GitHubTabs } from "../github-tabs";

export function NoRepository({ projectId, message }: { projectId: string; message: string }) {
  return (
    <Panel>
      <EmptyState
        icon={Github}
        title="No repository linked"
        description={message}
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/projects/${projectId}?tab=settings`}>Link a repository</Link>
          </Button>
        }
      />
    </Panel>
  );
}

export function GitHubTab({ project }: { project: Project }) {
  if (!project.github_url) return <NoRepository projectId={project.id} message="Connect a GitHub repository to see commits, pull requests and releases here." />;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <GitHubTabs githubUrl={project.github_url} />
      <div className="flex flex-col gap-4">
        <GitHubInfo githubUrl={project.github_url} />
        <BranchStatus githubUrl={project.github_url} />
      </div>
    </div>
  );
}
