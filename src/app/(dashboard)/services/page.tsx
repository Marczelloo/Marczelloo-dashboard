import { Suspense } from "react";
import Link from "next/link";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Skeleton, Button } from "@/components/ui";
import { services, projects } from "@/server/data";
import { Plus, Server } from "lucide-react";
import { ServicesList } from "./_components/services-list";

// Force dynamic rendering (no static prerendering)
export const dynamic = "force-dynamic";

async function ServicesContent() {
  const [standaloneServices, projectBoundServices, allProjects] = await Promise.all([
    services.getStandaloneServices(),
    services.getProjectBoundServices(),
    projects.getProjects(),
  ]);

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
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Services</h1>
              <p className="text-sm text-muted-foreground">All services across your infrastructure</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageInfoButton {...PAGE_INFO.services} />
            <Link href="/services/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Service
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6">
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
    </div>
  );
}
