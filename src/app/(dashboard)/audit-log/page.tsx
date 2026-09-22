import { AlertTriangle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EmptyState, Panel } from "@/components/ui";
import { listAudit } from "@/server/audit/list";
import { AuditView } from "./_components/audit-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

export default async function AuditLogPage() {
  const data = await listAudit().catch(() => null);

  return (
    <>
      <PageHeader title="Audit log" description="Everything done through the dashboard, and by whom" />
      <PageBody className="flex flex-col gap-4">
        {data ? (
          <AuditView data={data} />
        ) : (
          <Panel>
            <EmptyState icon={AlertTriangle} title="Audit log unavailable" description="The database did not answer. Reload in a moment." />
          </Panel>
        )}
      </PageBody>
    </>
  );
}
