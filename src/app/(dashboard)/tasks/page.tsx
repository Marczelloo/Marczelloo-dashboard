import { AlertTriangle } from "lucide-react";
import { PageBody } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listTasks } from "@/server/tasks/list";
import { TasksView } from "./_components/tasks-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  let data;
  try {
    data = await listTasks();
  } catch (error) {
    console.error("[tasks] Failed to load:", error);
    return (
      <PageBody>
        <Panel>
          <EmptyState icon={AlertTriangle} title="Tasks temporarily unavailable" description="The database did not answer. Reload in a moment." />
        </Panel>
      </PageBody>
    );
  }
  return <TasksView data={data} />;
}
