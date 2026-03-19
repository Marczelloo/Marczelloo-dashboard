"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Badge,
} from "@/components/ui";
import { PinDialog } from "@/components/pin-dialog";
import { createServiceAction } from "@/app/actions/services";
import { ArrowLeft, Plus, Server, Globe, Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NewServicePageProps {
  params: Promise<{}>;
}

export default function NewServicePage({ params }: NewServicePageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "external" as "docker" | "vercel" | "external",
    url: "",
    health_url: "",
    // Docker-specific fields
    portainer_endpoint_id: 0,
    container_id: "",
    repo_path: "",
    compose_project: "",
    deploy_strategy: "manual" as "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  const submitForm = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createServiceAction({
        project_id: undefined, // Standalone service - no project
        name: formData.name,
        type: formData.type,
        url: formData.url || undefined,
        health_url: formData.health_url || undefined,
        portainer_endpoint_id:
          formData.type === "docker" && formData.portainer_endpoint_id ? formData.portainer_endpoint_id : undefined,
        container_id: formData.type === "docker" ? formData.container_id || undefined : undefined,
        repo_path: formData.type === "docker" ? formData.repo_path || undefined : undefined,
        compose_project: formData.type === "docker" ? formData.compose_project || undefined : undefined,
        deploy_strategy: formData.type === "docker" ? formData.deploy_strategy : undefined,
      });

      if (!result.success) {
        // Check if PIN is required
        if ((result as { code?: string }).code === "PIN_REQUIRED") {
          setShowPinDialog(true);
          return;
        }
        setError(result.error || "Failed to create service");
        return;
      }

      toast.success("Service created successfully");
      router.push("/services");
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const typeOptions = [
    {
      value: "docker",
      label: "Docker Container",
      description: "Self-hosted container managed via Portainer",
      icon: <Server className="h-5 w-5" />,
    },
    {
      value: "vercel",
      label: "Vercel",
      description: "Deployed on Vercel (monitoring only)",
      icon: <Cloud className="h-5 w-5" />,
    },
    {
      value: "external",
      label: "External",
      description: "External website or service (monitoring only)",
      icon: <Globe className="h-5 w-5" />,
    },
  ];

  return (
    <>
      <Header title="Add Standalone Service" description="Add a service not tied to a specific project">
        <Link href="/services">
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
              <CardTitle>Service Details</CardTitle>
              <CardDescription>Configure the service type and connection details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              {/* Service Type Selection */}
              <div className="space-y-3">
                <Label>Service Type *</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {typeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, type: option.value as "docker" | "vercel" | "external" })
                      }
                      className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors ${
                        formData.type === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {option.icon}
                      <span className="font-medium text-sm">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Service Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., API Server, Web App, Database"
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
                    placeholder="https://example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="health_url">Health Check URL</Label>
                  <Input
                    id="health_url"
                    type="url"
                    value={formData.health_url}
                    onChange={(e) => setFormData({ ...formData, health_url: e.target.value })}
                    placeholder="https://example.com/health"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional endpoint for monitoring. Falls back to main URL if not set.
                  </p>
                </div>
              </div>

              {/* Docker-specific fields */}
              {formData.type === "docker" && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-medium">Docker Configuration</h3>

                  <div className="space-y-2">
                    <Label htmlFor="container_id">Container ID / Name</Label>
                    <Input
                      id="container_id"
                      value={formData.container_id}
                      onChange={(e) => setFormData({ ...formData, container_id: e.target.value })}
                      placeholder="container-name or ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repo_path">Repository Path</Label>
                    <Input
                      id="repo_path"
                      value={formData.repo_path}
                      onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                      placeholder="/home/pi/projects/my-app"
                    />
                    <p className="text-xs text-muted-foreground">Local path to the git repository for deployments</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="compose_project">Compose Project Name</Label>
                    <Input
                      id="compose_project"
                      value={formData.compose_project}
                      onChange={(e) => setFormData({ ...formData, compose_project: e.target.value })}
                      placeholder="my-app"
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
                          deploy_strategy: e.target.value as "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
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
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isLoading}>
                  <Plus className="h-4 w-4" />
                  {isLoading ? "Creating..." : "Create Service"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Standalone services are not tied to any project. To add a service to a project, go to the project page and click "Add Service" there.
          </p>
        </div>
      </div>

      <PinDialog
        open={showPinDialog}
        onSuccess={() => {
          setShowPinDialog(false);
          submitForm();
        }}
        onCancel={() => setShowPinDialog(false)}
      />
    </>
  );
}
