import type { Project } from "@/types";
import { ChangelogViewer } from "../changelog-viewer";
import { DependenciesViewer } from "../dependencies-viewer";
import { FileBrowser } from "../file-browser";
import { ReadmeViewer } from "../readme-viewer";
import { SecurityDashboard } from "../security-dashboard";
import { NoRepository } from "./github";

export function CodeTab({ project }: { project: Project }) {
  if (!project.github_url) return <NoRepository projectId={project.id} message="Connect a GitHub repository to browse files, dependencies and security alerts." />;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <ReadmeViewer githubUrl={project.github_url} />
        <SecurityDashboard githubUrl={project.github_url} />
      </div>
      <div className="flex flex-col gap-4">
        <FileBrowser githubUrl={project.github_url} />
        <DependenciesViewer githubUrl={project.github_url} />
        <ChangelogViewer githubUrl={project.github_url} />
      </div>
    </div>
  );
}
