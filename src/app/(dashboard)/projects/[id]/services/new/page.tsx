import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { projects } from "@/server/data";
import { AddService } from "@/app/(dashboard)/services/_components/add-service";

export const dynamic = "force-dynamic";

export default async function NewProjectServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await projects.getProjectById(id).catch(() => null);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        title="Add service"
        description={`Pick containers running on the Pi, or describe the service yourself · ${project.name}`}
        actions={
          <Button variant="ghost" asChild>
            <Link href={`/projects/${id}`}>
              <ArrowLeft strokeWidth={1.75} />
              Back to project
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AddService projectId={id} projectName={project.name} />
      </PageBody>
    </>
  );
}
