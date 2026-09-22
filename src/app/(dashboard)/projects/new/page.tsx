import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "../_components/project-form";
import { GitHubRepoSelector } from "../_components/github-repo-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, Github } from "lucide-react";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="New project" description="Create a new project" />
      <PageBody>
        <div className="mx-auto w-full max-w-[1024px]">
          <Tabs defaultValue="github" className="space-y-6">
            <TabsList>
              <TabsTrigger value="github">
                <Github strokeWidth={1.75} />
                Import from GitHub
              </TabsTrigger>
              <TabsTrigger value="manual">
                <PenLine strokeWidth={1.75} />
                Create manually
              </TabsTrigger>
            </TabsList>

            <TabsContent value="github">
              <Suspense fallback={<RepoSelectorSkeleton />}>
                <GitHubRepoSelector />
              </Suspense>
            </TabsContent>

            <TabsContent value="manual">
              <ProjectForm />
            </TabsContent>
          </Tabs>
        </div>
      </PageBody>
    </>
  );
}

function RepoSelectorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <div className="h-6 w-48 skeleton" />
        <div className="h-10 w-full skeleton" />
      </div>
      <div className="divide-y divide-line-subtle rounded-lg border border-line bg-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-10 w-10 rounded-full bg-surface-raised animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 skeleton" />
              <div className="h-3 w-2/3 skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
