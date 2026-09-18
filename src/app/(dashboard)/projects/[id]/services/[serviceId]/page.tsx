"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteServiceAction,
  updateServiceAction,
} from "@/app/actions/services";
import { EnvManager } from "@/components/features/env-manager";
import {
  FormActions,
  FormField,
  FormLayout,
  FormSection,
} from "@/components/layout/form-layout";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import type { Service } from "@/types";

interface ServiceDetailPageProps {
  params: Promise<{ id: string; serviceId: string }>;
}

function StatusSegment({
  label,
  children,
  detail,
}: {
  label: string;
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5">{children}</div>
      {detail && (
        <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>
      )}
    </div>
  );
}

export default function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id: projectId, serviceId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
    deploy_strategy: "pull_restart" as
      "pull_restart" | "pull_rebuild" | "compose_up" | "manual",
  });

  useEffect(() => {
    async function loadService() {
      try {
        const res = await fetch(`/api/services/${serviceId}`);
        const data = await res.json();
        if (data.service) {
          const current = data.service;
          setService(current);
          setFormData({
            name: current.name || "",
            type: current.type || "docker",
            url: current.url || "",
            health_url: current.health_url || "",
            container_id: current.container_id || "",
            repo_path: current.repo_path || "",
            compose_project: current.compose_project || "",
            deploy_strategy: current.deploy_strategy || "pull_restart",
          });
        }
      } catch {
        setError("Failed to load service");
      }
      setIsLoading(false);
    }
    loadService();
  }, [serviceId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateServiceAction(serviceId, {
        name: formData.name,
        type: formData.type,
        url: formData.url || undefined,
        health_url: formData.health_url || undefined,
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

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Service"
          description="Loading…"
          actions={
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft />
                Back to project
              </Button>
            </Link>
          }
        />
        <PageBody className="grid max-w-4xl gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={formData.name || "Service"}
        description={
          service?.url ||
          formData.url ||
          formData.container_id ||
          "External service"
        }
        actions={
          <>
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft />
                Back to project
              </Button>
            </Link>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={isDeleting}
              disabled={isSaving}
            >
              <Trash2 />
              Delete
            </Button>
          </>
        }
      />
      <PageBody className="grid max-w-4xl gap-4">
        <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
          <StatusSegment
            label="Status"
            detail={
              formData.type === "docker"
                ? "Container not queried here"
                : "External service"
            }
          >
            <p className="flex items-center gap-2 text-[18px] font-semibold leading-tight">
              <StatusDot status={formData.type === "docker" ? "idle" : "ok"} />
              {formData.type === "docker" ? "Unknown" : "External"}
            </p>
          </StatusSegment>
          <StatusSegment label="Type" detail="Service configuration">
            <p className="text-[18px] font-semibold leading-tight">
              <Chip mono>{formData.type}</Chip>
            </p>
          </StatusSegment>
          <StatusSegment label="Last deploy" detail="No deploy data available">
            <p className="text-[18px] font-semibold leading-tight tabular-nums">
              —
            </p>
          </StatusSegment>
          <StatusSegment label="Open logs" detail="Not available">
            <p className="text-[18px] font-semibold leading-tight tabular-nums">
              —
            </p>
          </StatusSegment>
        </Panel>

        <form onSubmit={handleSubmit}>
          <FormLayout>
            {error && (
              <p className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-md border border-ok/25 bg-ok/10 p-3 text-[13px] text-ok">
                {success}
              </p>
            )}
            <FormSection
              title="Service"
              description="Names and addresses used across the dashboard."
            >
              <FormField label="Service name" htmlFor="name">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData({ ...formData, name: event.target.value })
                  }
                  required
                />
              </FormField>
              <FormField label="URL" htmlFor="url">
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(event) =>
                    setFormData({ ...formData, url: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Health check URL" htmlFor="health_url">
                <Input
                  id="health_url"
                  type="url"
                  value={formData.health_url}
                  onChange={(event) =>
                    setFormData({ ...formData, health_url: event.target.value })
                  }
                />
              </FormField>
            </FormSection>
            {formData.type === "docker" && (
              <FormSection
                title="Docker"
                description="Where this service runs and how it is deployed."
              >
                <FormField label="Container ID / name" htmlFor="container_id">
                  <Input
                    id="container_id"
                    className="font-mono"
                    value={formData.container_id}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        container_id: event.target.value,
                      })
                    }
                  />
                </FormField>
                <FormField label="Repository path" htmlFor="repo_path">
                  <Input
                    id="repo_path"
                    className="font-mono"
                    value={formData.repo_path}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        repo_path: event.target.value,
                      })
                    }
                  />
                </FormField>
                <FormField
                  label="Compose project name"
                  htmlFor="compose_project"
                >
                  <Input
                    id="compose_project"
                    className="font-mono"
                    value={formData.compose_project}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        compose_project: event.target.value,
                      })
                    }
                  />
                </FormField>
                <FormField label="Deploy strategy" htmlFor="deploy_strategy">
                  <Select
                    value={formData.deploy_strategy}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        deploy_strategy:
                          value as typeof formData.deploy_strategy,
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
            <FormActions note="Changes are saved to this service.">
              <Button type="submit" loading={isSaving} disabled={isDeleting}>
                <Save />
                Save changes
              </Button>
            </FormActions>
          </FormLayout>
        </form>
        <EnvManager
          serviceId={serviceId}
          serviceName={formData.name}
          repoPath={formData.repo_path}
        />
      </PageBody>
    </>
  );
}
