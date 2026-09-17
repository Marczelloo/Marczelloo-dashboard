import { ProjectCloudflareTunnel } from "../project-cloudflare-tunnel";

export function DomainsTab({ projectId }: { projectId: string }) {
  return (
    <div className="max-w-3xl">
      <ProjectCloudflareTunnel projectId={projectId} />
    </div>
  );
}
