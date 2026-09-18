import Link from "next/link";
import { Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui";
import { listServices } from "@/server/services/list";
import { ServicesList } from "./_components/services-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const data = await listServices().catch(() => ({ rows: [], projects: [], live: false }));

  return (
    <>
      <PageHeader
        title="Services"
        description="Everything this dashboard watches or deploys"
        actions={
          <Button asChild>
            <Link href="/services/new">
              <Plus strokeWidth={1.75} />
              Add service
            </Link>
          </Button>
        }
      />
      <PageBody>
        <ServicesList data={data} />
      </PageBody>
    </>
  );
}
