import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Skeleton } from "@/components/ui";
import { getOverview } from "@/server/overview";
import { ProjectsGrid } from "./_components/projects-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects" };

async function ProjectsContent() {
  const overview = await getOverview().catch((error) => {
    console.error("[projects] Failed to load projects:", error);
    return null;
  });
  if (!overview) {
    return <p className="text-[13px] text-fg-3">Projects could not be loaded. The database or the agent did not answer.</p>;
  }
  return <ProjectsGrid rows={overview.fleet} />;
}

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Everything deployed from this Pi"
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <Plus strokeWidth={1.75} />
              New project
            </Link>
          </Button>
        }
      />
      <PageBody>
        <Suspense fallback={<ProjectsSkeleton />}>
          <ProjectsContent />
        </Suspense>
      </PageBody>
    </>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((index) => (
        <Skeleton key={index} className="h-[188px] rounded-lg" />
      ))}
    </div>
  );
}
