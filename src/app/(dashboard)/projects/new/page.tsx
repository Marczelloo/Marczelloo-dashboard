import { Header } from "@/components/layout";
import { ProjectForm } from "../_components/project-form";

export default function NewProjectPage() {
  return (
    <>
      <Header title="New Project" description="Create a new project" />

      <div className="p-6">
        <div className="max-w-2xl">
          <ProjectForm />
        </div>
      </div>
    </>
  );
}
