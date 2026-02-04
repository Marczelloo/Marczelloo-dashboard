import { Suspense } from "react";
import { Header } from "@/components/layout";
import { ProjectForm } from "../_components/project-form";
import { GitHubRepoSelector } from "../_components/github-repo-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PenLine, Github } from "lucide-react";

export default function NewProjectPage() {
  return (
    <>
      <Header title="New Project" description="Create a new project" />

      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue="github" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="github" className="flex items-center gap-2 text-sm">
                <Github className="h-4 w-4" />
                Import from GitHub
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2 text-sm">
                <PenLine className="h-4 w-4" />
                Create Manually
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
      </div>
    </>
  );
}

function RepoSelectorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6 space-y-4">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
      </div>
      <div className="rounded-xl border divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
