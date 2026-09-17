import { Suspense } from "react";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Skeleton } from "@/components/ui";
import { Plus } from "lucide-react";
import { ProjectsList } from "./_components/projects-list";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage your projects"
        actions={
          <Link href="/projects/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />
      <PageBody>
        <Suspense fallback={<ProjectsListSkeleton />}>
          <ProjectsList />
        </Suspense>
      </PageBody>
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
