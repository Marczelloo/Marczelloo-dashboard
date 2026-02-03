"use client";

import { useState, useEffect, use } from "react";
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
import { ArrowLeft, Plus, Server, Globe, Cloud, Loader2, Box, Check, Layers } from "lucide-react";
import { toast } from "sonner";

interface DockerContainer {
  id: string;
  name: string;
  status: string;
  state: string;
  image: string;
  ports: string[];
  endpointId: number;
  endpointName: string;
  composeProject: string | null;
  composeService: string | null;
  labels: Record<string, string>;
}

interface NewServicePageProps {
  params: Promise<{ id: string }>;
}

export default function NewServicePage({ params }: NewServicePageProps) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Docker containers
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [containersLoaded, setContainersLoaded] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);
  const [showContainerPicker, setShowContainerPicker] = useState(false);
  const [addingBatch, setAddingBatch] = useState(false);

  // Group containers by compose project
  const composeProjects = containers.reduce<Record<string, DockerContainer[]>>((acc, container) => {
    if (container.composeProject) {
      if (!acc[container.composeProject]) {
        acc[container.composeProject] = [];
      }
      acc[container.composeProject].push(container);
    }
    return acc;
  }, {});

  const [formData, setFormData] = useState({
    name: "",
    type: "docker" as "docker" | "vercel" | "external",
    url: "",
    health_url: "",
    container_id: "",
    portainer_endpoint_id: 0,
    repo_path: "",
    compose_project: "",
    deploy_strategy: "pull_restart" as "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
  });

  // Load containers when Docker type is selected
  useEffect(() => {
    if (formData.type === "docker" && !containersLoaded) {
      loadContainers();
    }
  }, [formData.type, containersLoaded]);

  async function loadContainers() {
    setLoadingContainers(true);
    try {
      const response = await fetch("/api/containers/list");
      const result = await response.json();
      if (result.success) {
        setContainers(result.data);
      }
    } catch {
      console.error("Failed to load containers");
    } finally {
      setLoadingContainers(false);
      setContainersLoaded(true);
    }
  }

  function selectContainer(container: DockerContainer) {
    setSelectedContainer(container);

    // Try to derive repo path from compose project (common convention)
    const repoPath = container.composeProject ? `/home/pi/projects/${container.composeProject}` : "";

    setFormData({
      ...formData,
      name: container.composeService || container.name,
      container_id: container.name,
      portainer_endpoint_id: container.endpointId,
      compose_project: container.composeProject || "",
      repo_path: repoPath,
    });
    setShowContainerPicker(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  async function addAllFromCompose(composeProjectName: string) {
    const projectContainers = composeProjects[composeProjectName];
    if (!projectContainers || projectContainers.length === 0) return;

    setAddingBatch(true);
    toast.info(`Adding ${projectContainers.length} services from ${composeProjectName}...`);

    const _firstContainer = projectContainers[0];
    const repoPath = `/home/Marczelloo_pi/projects/${composeProjectName}`;

    let successCount = 0;
    let failCount = 0;

    for (const container of projectContainers) {
      try {
        const result = await createServiceAction({
          project_id: projectId,
          name: container.composeService || container.name,
          type: "docker",
          portainer_endpoint_id: container.endpointId,
          container_id: container.name,
          repo_path: repoPath, // All services share the same repo path
          compose_project: composeProjectName,
          deploy_strategy: "compose_up", // Use compose_up for multi-service projects
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to add ${container.name}:`, result.error);
        }
      } catch (err) {
        failCount++;
        console.error(`Error adding ${container.name}:`, err);
      }
    }

    setAddingBatch(false);

    if (successCount > 0) {
      toast.success(`Added ${successCount} services`, {
        description: failCount > 0 ? `${failCount} failed` : `From ${composeProjectName}`,
      });
      router.push(`/projects/${projectId}`);
    } else {
      toast.error("Failed to add services");
    }
  }

  const submitForm = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createServiceAction({
        project_id: projectId,
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

      router.push(`/projects/${projectId}`);
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
      <Header title="Add Service" description="Add a new service to this project">
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
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Docker Configuration</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowContainerPicker(!showContainerPicker)}
                      disabled={loadingContainers}
                    >
                      {loadingContainers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                      {showContainerPicker ? "Hide Containers" : "Pick from Docker"}
                    </Button>
                  </div>

                  {/* Container Picker */}
                  {showContainerPicker && (
                    <div className="space-y-4 p-4 rounded-lg border border-border bg-secondary/30 max-h-96 overflow-y-auto">
                      {loadingContainers ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : containers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No containers found. Make sure Portainer is connected.
                        </p>
                      ) : (
                        <>
                          {/* Batch Add by Compose Project */}
                          {Object.keys(composeProjects).length > 0 && (
                            <div className="space-y-2 pb-3 border-b border-border">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                Quick Add All Services from Project
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {Object.entries(composeProjects).map(([projectName, projectContainers]) => (
                                  <Button
                                    key={projectName}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="justify-start h-auto py-2"
                                    onClick={() => addAllFromCompose(projectName)}
                                    disabled={addingBatch}
                                  >
                                    {addingBatch ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    <div className="text-left">
                                      <p className="font-medium">{projectName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {projectContainers.length} service{projectContainers.length !== 1 ? "s" : ""}
                                      </p>
                                    </div>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Individual container selection */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Or select individual container</p>
                            {containers.map((container) => (
                              <button
                                key={container.id}
                                type="button"
                                onClick={() => selectContainer(container)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                                  selectedContainer?.id === container.id
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50 bg-background"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`h-2 w-2 rounded-full ${
                                      container.status === "running"
                                        ? "bg-success"
                                        : container.status === "stopped"
                                          ? "bg-muted-foreground"
                                          : "bg-warning"
                                    }`}
                                  />
                                  <div>
                                    <p className="font-medium text-sm">{container.name}</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {container.composeProject && (
                                        <span className="text-primary">[{container.composeProject}] </span>
                                      )}
                                      {container.image}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {container.ports.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {container.ports[0]}
                                    </Badge>
                                  )}
                                  {selectedContainer?.id === container.id && <Check className="h-4 w-4 text-primary" />}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Selected container info */}
                  {selectedContainer && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                      <p className="font-medium">Selected: {selectedContainer.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedContainer.composeProject && (
                          <span>Project: {selectedContainer.composeProject} • </span>
                        )}
                        Image: {selectedContainer.image} • Endpoint: {selectedContainer.endpointName}
                      </p>
                    </div>
                  )}

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
