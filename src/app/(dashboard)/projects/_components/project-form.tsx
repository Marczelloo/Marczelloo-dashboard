"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { createProjectAction, updateProjectAction } from "@/app/actions/projects";
import { slugify } from "@/lib/utils";
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

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(project?.name || "");
  const [slug, setSlug] = useState(project?.slug || "");
  const [description, setDescription] = useState(project?.description || "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status || "active");
  const [tags, setTags] = useState(project?.tags?.join(", ") || "");
  const [technologies, setTechnologies] = useState(project?.technologies?.join(", ") || "");
  const [githubUrl, setGithubUrl] = useState(project?.github_url || "");
  const [prodUrl, setProdUrl] = useState(project?.prod_url || "");
  const [vercelUrl, setVercelUrl] = useState(project?.vercel_url || "");
  const [notes, setNotes] = useState(project?.notes || "");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!project) {
      setSlug(slugify(value));
    }
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
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      technologies: technologies
        ? technologies
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      github_url: githubUrl || undefined,
      prod_url: prodUrl || undefined,
      vercel_url: vercelUrl || undefined,
      notes: notes || undefined,
    };

    try {
      const result = project ? await updateProjectAction(project.id, formData) : await createProjectAction(formData);

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
    <Card>
      <CardHeader>
        <CardTitle>{project ? "Edit Project" : "Create Project"}</CardTitle>
        <CardDescription>
          {project ? "Update the project details below" : "Fill in the details to create a new project"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Project Name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="project-name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="production, internal, api"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="technologies">Technologies</Label>
            <Input
              id="technologies"
              value={technologies}
              onChange={(e) => setTechnologies(e.target.value)}
              placeholder="nextjs, react, typescript, docker"
            />
            <p className="text-xs text-muted-foreground">Comma-separated. Links to docs are shown automatically.</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Links</h3>

            <div className="space-y-2">
              <Label htmlFor="github_url">GitHub URL</Label>
              <Input
                id="github_url"
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod_url">Production URL</Label>
              <Input
                id="prod_url"
                type="url"
                value={prodUrl}
                onChange={(e) => setProdUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vercel_url">Vercel URL</Label>
              <Input
                id="vercel_url"
                type="url"
                value={vercelUrl}
                onChange={(e) => setVercelUrl(e.target.value)}
                placeholder="https://example.vercel.app"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Markdown)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Project documentation, runbooks, etc."
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" loading={isLoading}>
              {project ? "Update Project" : "Create Project"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
