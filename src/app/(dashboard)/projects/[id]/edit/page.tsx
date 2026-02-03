"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea, Label } from "@/components/ui";
import { updateProjectAction, deleteProjectAction } from "@/app/actions/projects";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function EditProjectPage({ params }: EditProjectPageProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    github_url: "",
    prod_url: "",
    vercel_url: "",
    tags: "",
    technologies: "",
    notes: "",
  });

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);
      // Fetch project data
      fetch(`/api/projects/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.project) {
            const p = data.project;
            setFormData({
              name: p.name || "",
              slug: p.slug || "",
              description: p.description || "",
              status: p.status || "active",
              github_url: p.github_url || "",
              prod_url: p.prod_url || "",
              vercel_url: p.vercel_url || "",
              tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
              technologies: Array.isArray(p.technologies) ? p.technologies.join(", ") : "",
              notes: p.notes || "",
            });
          }
        })
        .catch(() => setError("Failed to load project"));
    });
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await updateProjectAction(projectId, {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || undefined,
        status: formData.status as "active" | "inactive" | "archived" | "maintenance",
        github_url: formData.github_url || undefined,
        prod_url: formData.prod_url || undefined,
        vercel_url: formData.vercel_url || undefined,
        tags: formData.tags
          ? formData.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        technologies: formData.technologies
          ? formData.technologies
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        notes: formData.notes || undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to update project");
        return;
      }

      router.push(`/projects/${projectId}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteProjectAction(projectId);

      if (!result.success) {
        setError(result.error || "Failed to delete project");
        return;
      }

      router.push("/projects");
    } catch {
      setError("Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Header title="Edit Project" description="Update project settings">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </Header>

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="github_url">GitHub URL</Label>
                <Input
                  id="github_url"
                  type="url"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prod_url">Production URL</Label>
                  <Input
                    id="prod_url"
                    type="url"
                    value={formData.prod_url}
                    onChange={(e) => setFormData({ ...formData, prod_url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vercel_url">Vercel URL</Label>
                  <Input
                    id="vercel_url"
                    type="url"
                    value={formData.vercel_url}
                    onChange={(e) => setFormData({ ...formData, vercel_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="dashboard, production, api"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technologies">Technologies (comma-separated)</Label>
                  <Input
                    id="technologies"
                    value={formData.technologies}
                    onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                    placeholder="nextjs, react, typescript, docker"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting || isLoading}>
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete Project"}
                </Button>

                <Button type="submit" disabled={isLoading || isDeleting}>
                  <Save className="h-4 w-4" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  );
}
