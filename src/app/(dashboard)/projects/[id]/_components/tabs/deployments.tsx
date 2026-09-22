import type { ProjectDetail } from "@/server/projects/detail";
import { ProjectDeploysClient } from "../project-deploys";
import { ProjectDeployEngine } from "../project-deploy-engine";
import { ReleaseCreator } from "../release-creator";

export function DeploymentsTab({ detail }: { detail: ProjectDetail }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <ProjectDeploysClient projectId={detail.project.id} deploys={detail.deploys} services={detail.services} />
      </div>
      <div className="flex flex-col gap-4">
        <ProjectDeployEngine projectId={detail.project.id} />
        {detail.project.github_url && <ReleaseCreator githubUrl={detail.project.github_url} />}
      </div>
    </div>
  );
}
