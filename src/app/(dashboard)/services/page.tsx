import { Suspense } from "react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Skeleton, Button } from "@/components/ui";
import { services, projects } from "@/server/data";
import { Plus } from "lucide-react";
import { ServicesList } from "./_components/services-list";

// Force dynamic rendering (no static prerendering)
export const dynamic = "force-dynamic";

async function ServicesContent() {
  const [allServices, allProjects] = await Promise.all([
    services.getServices().catch((error) => {
      console.error("[ServicesPage] Failed to load services:", error);
      return [];
    }),
    projects.getProjects().catch((error) => {
      console.error("[ServicesPage] Failed to load projects:", error);
      return [];
    }),
  ]);

  const standaloneServices = allServices.filter((service) => !service.project_id);
  const projectBoundServices = allServices.filter((service) => !!service.project_id);

  return (
    <ServicesList
      standaloneServices={standaloneServices}
      projectBoundServices={projectBoundServices}
      projects={allProjects}
    />
  );
}

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Services"
        description="All services across your infrastructure"
        actions={
          <Link href="/services/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Service
            </Button>
          </Link>
        }
      />
      <PageBody>
        <Suspense
          fallback={
            <div className="space-y-4">
              <Skeleton className="h-14 rounded-lg" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 rounded-lg" />
                ))}
              </div>
            </div>
          }
        >
          <ServicesContent />
        </Suspense>
      </PageBody>
    </>
  );
}
