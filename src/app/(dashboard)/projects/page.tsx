import { Suspense } from "react";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { Header } from "@/components/layout";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Button, Skeleton } from "@/components/ui";
import { Plus } from "lucide-react";
import { ProjectsList } from "./_components/projects-list";

export default function ProjectsPage() {
  return (
    <>
      <Header title="Projects" description="Manage your projects">
        <div className="flex items-center gap-2">
          <PageInfoButton {...PAGE_INFO.projects} />
          <Link href="/projects/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>
      </Header>

      <div className="p-6">
        <Suspense fallback={<ProjectsListSkeleton />}>
          <ProjectsList />
        </Suspense>
      </div>
    </>
  );
}

function ProjectsListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}
