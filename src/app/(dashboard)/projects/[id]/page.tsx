import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageBody } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { isDemoMode } from "@/lib/demo-mode";
import { getProjectDetail } from "@/server/projects/detail";
import { ProjectHeader } from "./_components/project-header";
import { ProjectStatusStrip } from "./_components/project-status-strip";
import { ProjectTabs, projectTabFrom } from "./_components/project-tabs";
import { CodeTab } from "./_components/tabs/code";
import { DeploymentsTab } from "./_components/tabs/deployments";
import { DomainsTab } from "./_components/tabs/domains";
import { EnvironmentTab } from "./_components/tabs/environment";
import { GitHubTab } from "./_components/tabs/github";
import { LogsTab } from "./_components/tabs/logs";
import { OverviewTab } from "./_components/tabs/overview";
import { SettingsTab } from "./_components/tabs/settings";
import { TasksTab } from "./_components/tabs/tasks";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const active = projectTabFrom(tab);

  let detail;
  try {
    detail = await getProjectDetail(id);
  } catch (error) {
    console.error(`[project] Failed to load ${id}:`, error);
    return (
      <PageBody>
        <Panel>
          <EmptyState icon={AlertTriangle} title="Project temporarily unavailable" description="The database did not answer. Reload in a moment." />
        </Panel>
      </PageBody>
    );
  }
  if (!detail) notFound();

  return (
    <PageBody className="flex flex-col gap-4">
      <ProjectHeader detail={detail} />
      <ProjectStatusStrip detail={detail} />
      <ProjectTabs projectId={id} active={active} />
      {active === "overview" && <OverviewTab detail={detail} />}
      {active === "deployments" && <DeploymentsTab detail={detail} />}
      {active === "logs" && <LogsTab services={detail.services} />}
      {active === "environment" && <EnvironmentTab service={detail.primaryService} repoPath={detail.config?.repoPath ?? null} />}
      {active === "domains" && <DomainsTab projectId={id} />}
      {active === "github" && <GitHubTab project={detail.project} />}
      {active === "code" && <CodeTab project={detail.project} />}
      {active === "tasks" && <TasksTab projectId={id} items={detail.workItems} />}
      {active === "settings" && <SettingsTab detail={detail} managed={detail.config !== null || isDemoMode()} />}
    </PageBody>
  );
}
