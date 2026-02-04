import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Skeleton, Button } from "@/components/ui";
import { getStandaloneServices, getProjectBoundServices } from "@/server/atlashub/services";
import { getProjects } from "@/server/atlashub/projects";
import { Plus } from "lucide-react";
import { ServicesList } from "./_components/services-list";

// Force dynamic rendering (no static prerendering)
export const dynamic = "force-dynamic";

async function ServicesContent() {
  const [standaloneServices, projectBoundServices, projects] = await Promise.all([
    getStandaloneServices(),
    getProjectBoundServices(),
    getProjects(),
  ]);

  return (
    <ServicesList
      standaloneServices={standaloneServices}
      projectBoundServices={projectBoundServices}
      projects={projects}
    />
  );
}

export default function ServicesPage() {
  return (
    <>
      <Header title="Services" description="All services across your infrastructure">
        <Link href="/services/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Service
          </Button>
        </Link>
      </Header>

      <div className="p-6">
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
      </div>
    </>
  );
}
