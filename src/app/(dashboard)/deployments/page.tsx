import { AlertTriangle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listDeploys } from "@/server/deploys/list";
import { DeploymentsView } from "./_components/deployments-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deployments" };

export default async function DeploymentsPage() {
  const data = await listDeploys().catch(() => null);

  return (
    <>
      <PageHeader title="Deployments" description="Every release this dashboard has pushed to the Pi" />
      <PageBody className="flex flex-col gap-4">
        {data ? (
          <DeploymentsView data={data} />
        ) : (
          <Panel>
            <EmptyState icon={AlertTriangle} title="Deployments unavailable" description="The database did not answer. Reload in a moment." />
          </Panel>
        )}
      </PageBody>
    </>
  );
}
