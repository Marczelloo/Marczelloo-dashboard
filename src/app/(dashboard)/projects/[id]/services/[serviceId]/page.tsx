"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge, Skeleton } from "@/components/ui";
import { EnvManager } from "@/components/features/env-manager";
import { updateServiceAction, deleteServiceAction, deployServiceAction } from "@/app/actions/services";
import { ArrowLeft, Save, Trash2, Rocket, RefreshCw, Server, Globe, Cloud } from "lucide-react";
import type { Service } from "@/types";
import { formatDateTime } from "@/lib/utils";

interface ServiceDetailPageProps {
  params: Promise<{ id: string; serviceId: string }>;
}

export default function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id: projectId, serviceId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "docker" as "docker" | "vercel" | "external",
    url: "",
    health_url: "",
    container_id: "",
    repo_path: "",
    compose_project: "",
    deploy_strategy: "pull_restart" as "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
  });

  useEffect(() => {
    async function loadService() {
      try {
        const res = await fetch(`/api/services/${serviceId}`);
        const data = await res.json();
        if (data.service) {
          const s = data.service;
          setService(s);
          setFormData({
            name: s.name || "",
            type: s.type || "docker",
            url: s.url || "",
            health_url: s.health_url || "",
            container_id: s.container_id || "",
            repo_path: s.repo_path || "",
            compose_project: s.compose_project || "",
            deploy_strategy: s.deploy_strategy || "pull_restart",
          });
        }
      } catch {
        setError("Failed to load service");
      }
      setIsLoading(false);
    }
    loadService();
  }, [serviceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const result = await updateServiceAction(serviceId, {
        name: formData.name,
        type: formData.type,
        url: formData.url || undefined,
        health_url: formData.health_url || undefined,
        container_id: formData.type === "docker" ? formData.container_id || undefined : undefined,
        repo_path: formData.type === "docker" ? formData.repo_path || undefined : undefined,
        compose_project: formData.type === "docker" ? formData.compose_project || undefined : undefined,
        deploy_strategy: formData.type === "docker" ? formData.deploy_strategy : undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to update service");
        return;
      }

      setSuccess("Service updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this service?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteServiceAction(serviceId);

      if (!result.success) {
        setError(result.error || "Failed to delete service");
        return;
      }

      router.push(`/projects/${projectId}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeploy = async () => {
    if (!confirm("Deploy this service? This will pull changes and restart the container.")) {
      return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      const result = await deployServiceAction(serviceId);

      if (!result.success) {
        setError(result.error || "Deployment failed");
        return;
      }

      setSuccess(`Deployment successful! Commit: ${result.data?.commit_sha?.slice(0, 7) || "N/A"}`);
    } catch {
      setError("Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  const typeIcons = {
    docker: <Server className="h-5 w-5" />,
    vercel: <Cloud className="h-5 w-5" />,
    external: <Globe className="h-5 w-5" />,
  };

  if (isLoading) {
    return (
      <>
        <Header title="Service" description="Loading...">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </Header>
        <div className="p-6 max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={formData.name || "Service"}
        description={service ? `Created ${formatDateTime(service.created_at)}` : ""}
      >
        <div className="flex items-center gap-2">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          {formData.type === "docker" && (
            <Button variant="default" size="sm" onClick={handleDeploy} disabled={isDeploying || isSaving || isDeleting}>
              {isDeploying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {isDeploying ? "Deploying..." : "Deploy"}
            </Button>
          )}
        </div>
      </Header>

      <div className="p-6 max-w-4xl space-y-6">
        {/* Service Status */}
        <div className="flex items-center gap-3">
          {typeIcons[formData.type]}
          <Badge variant="secondary">{formData.type}</Badge>
          {formData.url && (
            <a
              href={formData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {formData.url}
            </a>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Edit Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              {success && <div className="rounded-lg bg-success/10 p-3 text-sm text-success">{success}</div>}

              <div className="space-y-2">
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="health_url">Health Check URL</Label>
                <Input
                  id="health_url"
                  type="url"
                  value={formData.health_url}
                  onChange={(e) => setFormData({ ...formData, health_url: e.target.value })}
                />
              </div>

              {formData.type === "docker" && (
                <>
                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-4">Docker Configuration</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="container_id">Container ID / Name</Label>
                        <Input
                          id="container_id"
                          value={formData.container_id}
                          onChange={(e) => setFormData({ ...formData, container_id: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="repo_path">Repository Path</Label>
                        <Input
                          id="repo_path"
                          value={formData.repo_path}
                          onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="compose_project">Compose Project Name</Label>
                        <Input
                          id="compose_project"
                          value={formData.compose_project}
                          onChange={(e) => setFormData({ ...formData, compose_project: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="deploy_strategy">Deploy Strategy</Label>
                        <select
                          id="deploy_strategy"
                          value={formData.deploy_strategy}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deploy_strategy: e.target.value as
                                | "pull_restart"
                                | "pull_rebuild"
                                | "compose_up"
                                | "manual",
                            })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="pull_restart">Git Pull + Restart Container</option>
                          <option value="pull_rebuild">Git Pull + Rebuild Image</option>
                          <option value="compose_up">Docker Compose Up</option>
                          <option value="manual">Manual Only</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving || isDeploying}
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>

                <Button type="submit" disabled={isSaving || isDeleting || isDeploying}>
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Environment Variables */}
        <EnvManager serviceId={serviceId} serviceName={formData.name} repoPath={formData.repo_path} />
      </div>
    </>
  );
}
