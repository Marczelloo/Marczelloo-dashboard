import { Suspense } from "react";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Button, Skeleton } from "@/components/ui";
import { Plus, FolderKanban } from "lucide-react";
import { ProjectsList } from "./_components/projects-list";

export default function ProjectsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Projects</h1>
              <p className="text-sm text-muted-foreground">Manage your projects</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageInfoButton {...PAGE_INFO.projects} />
            <Link href="/projects/new">
              <Button>
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6">
        <Suspense fallback={<ProjectsListSkeleton />}>
          <ProjectsList />
        </Suspense>
      </div>
    </div>
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
