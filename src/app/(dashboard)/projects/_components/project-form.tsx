"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProjectAction,
  updateProjectAction,
} from "@/app/actions/projects";
import { slugify } from "@/lib/utils";
import {
  FormActions,
  FormField,
  FormLayout,
  FormSection,
} from "@/components/layout/form-layout";
import {
  Button,
  Chip,
  Input,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import type { Project, ProjectStatus } from "@/types";

interface ProjectFormProps {
  project?: Project;
}
const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "maintenance", label: "Maintenance" },
  { value: "archived", label: "Archived" },
];
const toList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(project?.name || "");
  const [slug, setSlug] = useState(project?.slug || "");
  const [description, setDescription] = useState(project?.description || "");
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status || "active",
  );
  const [tags, setTags] = useState(project?.tags?.join(", ") || "");
  const [technologies, setTechnologies] = useState(
    project?.technologies?.join(", ") || "",
  );
  const [githubUrl, setGithubUrl] = useState(project?.github_url || "");
  const [prodUrl, setProdUrl] = useState(project?.prod_url || "");
  const [vercelUrl, setVercelUrl] = useState(project?.vercel_url || "");
  const [notes, setNotes] = useState(project?.notes || "");
  const handleNameChange = (value: string) => {
    setName(value);
    if (!project) setSlug(slugify(value));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = {
      name,
      slug,
      description: description || undefined,
      status,
      tags: toList(tags),
      technologies: toList(technologies),
      github_url: githubUrl || undefined,
      prod_url: prodUrl || undefined,
      vercel_url: vercelUrl || undefined,
      notes: notes || undefined,
    };
    try {
      const result = project
        ? await updateProjectAction(project.id, formData)
        : await createProjectAction(formData);
      if (!result.success) {
        setError(result.error || "Something went wrong");
        return;
      }
      router.push("/projects");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      <FormLayout
        rail={
          <Panel className="grid gap-2.5 p-3.5">
            <p className="text-[11px] font-medium text-fg-4">
              PREVIEW IN THE LIST
            </p>
            <div className="rounded-md border border-line p-3">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                <StatusDot
                  status={
                    status === "active"
                      ? "ok"
                      : status === "maintenance"
                        ? "warn"
                        : "idle"
                  }
                />
                <span className="truncate">{name || "Untitled project"}</span>
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-fg-3">
                {prodUrl || "no domain"}
              </p>
              {toList(tags).length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {toList(tags)
                    .slice(0, 4)
                    .map((tag) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                </div>
              )}
            </div>
            <p className="text-[11px] font-medium text-fg-4">ADDRESS</p>
            <code className="text-[11.5px] text-fg-2">
              /projects/{slug || "…"}
            </code>
          </Panel>
        }
      >
        {error && (
          <p className="rounded-md border border-err/25 bg-err/10 p-3 text-sm text-err">
            {error}
          </p>
        )}
        <FormSection
          title="Identity"
          description="How the project appears across the dashboard."
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Name" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Project name"
                required
              />
            </FormField>
            <FormField label="Slug" htmlFor="slug">
              <Input
                id="slug"
                className="font-mono"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="project-name"
                required
              />
            </FormField>
          </div>
          <FormField label="Description" htmlFor="description">
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project"
              rows={3}
            />
          </FormField>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Status" htmlFor="status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ProjectStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tags" htmlFor="tags" hint="Comma separated.">
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="production, internal, api"
              />
            </FormField>
          </div>
        </FormSection>
        <FormSection
          title="Links"
          description="Repository, deployments, and technologies."
        >
          <FormField label="GitHub URL" htmlFor="github_url">
            <Input
              id="github_url"
              type="url"
              className="font-mono"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
            />
          </FormField>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Production URL" htmlFor="prod_url">
              <Input
                id="prod_url"
                type="url"
                className="font-mono"
                value={prodUrl}
                onChange={(e) => setProdUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </FormField>
            <FormField label="Vercel URL" htmlFor="vercel_url">
              <Input
                id="vercel_url"
                type="url"
                className="font-mono"
                value={vercelUrl}
                onChange={(e) => setVercelUrl(e.target.value)}
                placeholder="https://example.vercel.app"
              />
            </FormField>
          </div>
          <FormField
            label="Technologies"
            htmlFor="technologies"
            hint="Comma separated. Links to documentation appear automatically."
          >
            <Input
              id="technologies"
              value={technologies}
              onChange={(e) => setTechnologies(e.target.value)}
              placeholder="nextjs, react, typescript, docker"
            />
          </FormField>
          <FormField label="Notes (Markdown)" htmlFor="notes">
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Project documentation, runbooks, etc."
              rows={6}
              className="font-mono text-sm"
            />
          </FormField>
        </FormSection>
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {project ? "Update project" : "Create project"}
          </Button>
        </FormActions>
      </FormLayout>
    </form>
  );
}
