import { DatabaseZap } from "lucide-react";
import { isDemoMode } from "@/lib/demo-mode";
import { appImport } from "@/server/atlashub";
import { projects } from "@/server/data";
import { requireAuth } from "@/server/lib/auth";
import { ImportWizard } from "./_components/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const demo = isDemoMode();
  if (!demo) await requireAuth();
  const [configs, projectRows] = await Promise.all([
    demo ? Promise.resolve([]) : appImport.listAppConfigs().catch(() => []),
    projects.getProjects({ limit: 1000 }),
  ]);
  const projectNames = new Map(projectRows.map((project) => [project.id, project.name]));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <DatabaseZap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Import projektów</h1>
            <p className="text-sm text-muted-foreground">Skan serwera tylko do odczytu. Nic nie zmienia działających kontenerów.</p>
          </div>
        </div>
      </header>
      <div className="flex-1 space-y-6 p-6">
        <ImportWizard imported={configs.map((config) => ({ composeProject: config.compose_project, projectName: projectNames.get(config.project_id) ?? config.project_id, updatedAt: config.updated_at }))} />
      </div>
    </div>
  );
}
