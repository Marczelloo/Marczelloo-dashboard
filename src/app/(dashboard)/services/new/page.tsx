"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  FormActions,
  FormField,
  FormLayout,
  FormSection,
} from "@/components/layout/form-layout";
import {
  Button,
  Input,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
    deploy_strategy: "manual" as
      "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
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
          formData.type === "docker" && formData.portainer_endpoint_id
            ? formData.portainer_endpoint_id
            : undefined,
        container_id:
          formData.type === "docker"
            ? formData.container_id || undefined
            : undefined,
        repo_path:
          formData.type === "docker"
            ? formData.repo_path || undefined
            : undefined,
        compose_project:
          formData.type === "docker"
            ? formData.compose_project || undefined
            : undefined,
        deploy_strategy:
          formData.type === "docker" ? formData.deploy_strategy : undefined,
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
      <PageHeader
        title="Add standalone service"
        description="Add a service not tied to a specific project"
        actions={
          <Link href="/services">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />
      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormLayout
            rail={
              <Panel className="grid gap-2.5 p-3.5">
                <p className="text-[11px] font-medium text-fg-4">
                  SERVICE TYPE
                </p>
                <p className="text-[13px] text-fg-2">
                  {formData.type === "docker"
                    ? "A container running on the Pi."
                    : formData.type === "vercel"
                      ? "Deployed elsewhere on Vercel and monitored here."
                      : "An external service that is only monitored."}
                </p>
              </Panel>
            }
          >
            {error && (
              <div className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">
                {error}
              </div>
            )}

            <FormSection
              title="Service"
              description="Choose how this service is hosted."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {typeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        type: option.value as "docker" | "vercel" | "external",
                      })
                    }
                    className={`flex flex-col items-center gap-2 rounded-lg border border-line p-4 text-center transition-colors ${
                      formData.type === option.value
                        ? "border-primary bg-primary/10"
                        : "hover:border-accent/50"
                    }`}
                  >
                    {option.icon}
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-fg-3">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
              <FormField label="Service name" htmlFor="name">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., API Server, Web App, Database"
                  required
                />
              </FormField>
            </FormSection>
            <FormSection
              title="Connection"
              description="Addresses used to reach and monitor the service."
            >
              <FormField label="URL" htmlFor="url">
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </FormField>
              <FormField
                label="Health check URL"
                htmlFor="health_url"
                hint="Optional endpoint for monitoring. Falls back to the main URL."
              >
                <Input
                  id="health_url"
                  type="url"
                  value={formData.health_url}
                  onChange={(e) =>
                    setFormData({ ...formData, health_url: e.target.value })
                  }
                  placeholder="https://example.com/health"
                />
              </FormField>
            </FormSection>

            {/* Docker-specific fields */}
            {formData.type === "docker" && (
              <FormSection
                title="Docker"
                description="Deployment details for the Pi container."
              >
                <FormField label="Container ID / name" htmlFor="container_id">
                  <Input
                    id="container_id"
                    value={formData.container_id}
                    onChange={(e) =>
                      setFormData({ ...formData, container_id: e.target.value })
                    }
                    placeholder="container-name or ID"
                  />
                </FormField>

                <FormField
                  label="Repository path"
                  htmlFor="repo_path"
                  hint="Local path to the Git repository for deployments."
                >
                  <Input
                    id="repo_path"
                    value={formData.repo_path}
                    onChange={(e) =>
                      setFormData({ ...formData, repo_path: e.target.value })
                    }
                    placeholder="/home/pi/projects/my-app"
                  />
                </FormField>

                <FormField
                  label="Compose project name"
                  htmlFor="compose_project"
                >
                  <Input
                    id="compose_project"
                    value={formData.compose_project}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        compose_project: e.target.value,
                      })
                    }
                    placeholder="my-app"
                  />
                </FormField>

                <FormField label="Deploy strategy" htmlFor="deploy_strategy">
                  <Select
                    value={formData.deploy_strategy}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        deploy_strategy: value as
                          | "pull_restart"
                          | "pull_rebuild"
                          | "compose_up"
                          | "manual",
                      })
                    }
                  >
                    <SelectTrigger id="deploy_strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pull_restart">
                        Git pull + restart container
                      </SelectItem>
                      <SelectItem value="pull_rebuild">
                        Git pull + rebuild image
                      </SelectItem>
                      <SelectItem value="compose_up">
                        Docker Compose up
                      </SelectItem>
                      <SelectItem value="manual">Manual only</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </FormSection>
            )}

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
                <Plus className="h-4 w-4" />
                Create service
              </Button>
            </FormActions>
          </FormLayout>
        </form>
      </PageBody>

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
