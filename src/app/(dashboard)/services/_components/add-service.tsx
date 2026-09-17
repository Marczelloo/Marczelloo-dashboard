"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Check, Cloud, Globe, Loader2, Server } from "lucide-react";
import { toast } from "sonner";
import { createServiceAction } from "@/app/actions/services";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { FormActions, FormField, FormLayout, FormSection } from "@/components/layout/form-layout";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ServiceType } from "@/types";

interface HostContainer {
  id: string;
  name: string;
  status: string;
  state: string;
  image: string;
  ports: string[];
  endpointId: number;
  composeProject: string | null;
  composeService: string | null;
}

const TYPES: Array<{ value: ServiceType; label: string; icon: typeof Box; blurb: string }> = [
  { value: "docker", label: "Docker container", icon: Box, blurb: "A container running on the Pi. The dashboard can deploy, restart and watch it." },
  { value: "vercel", label: "Vercel", icon: Cloud, blurb: "Deployed on Vercel. The dashboard only links to it and watches its address." },
  { value: "external", label: "External", icon: Globe, blurb: "Anything else with a URL. The dashboard only checks whether it answers." },
];

const REPO_ROOT = "/home/Marczelloo_pi/projects";

function groupByProject(containers: HostContainer[]) {
  const groups = new Map<string, HostContainer[]>();
  for (const container of containers) {
    const key = container.composeProject ?? "Standalone containers";
    groups.set(key, [...(groups.get(key) ?? []), container]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function AddService({ projectId, projectName }: { projectId: string | null; projectName?: string }) {
  const router = useRouter();
  const guard = usePinGuard();

  const [containers, setContainers] = useState<HostContainer[]>([]);
  const [loadingHost, setLoadingHost] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const [manual, setManual] = useState({ name: "", type: "docker" as ServiceType, url: "", health_url: "", compose_project: "", repo_path: "", container_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/containers/list")
      .then((response) => response.json())
      .then((result: { success: boolean; data?: HostContainer[] }) => {
        if (mounted && result.success && result.data) setContainers(result.data);
      })
      .catch(() => undefined)
      .finally(() => mounted && setLoadingHost(false));
    return () => {
      mounted = false;
    };
  }, []);

  const groups = useMemo(() => groupByProject(containers), [containers]);
  const selected = containers.filter((container) => picked.has(container.id));

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (group: HostContainer[]) =>
    setPicked((current) => {
      const next = new Set(current);
      const allPicked = group.every((container) => next.has(container.id));
      for (const container of group) {
        if (allPicked) next.delete(container.id);
        else next.add(container.id);
      }
      return next;
    });

  const addSelected = async () => {
    if (selected.length === 0) return;
    setAdding(true);
    let added = 0;
    let failed = 0;
    for (const container of selected) {
      const compose = container.composeProject;
      const result = await guard.run(() =>
        createServiceAction({
          project_id: projectId ?? undefined,
          name: container.composeService ?? container.name,
          type: "docker",
          portainer_endpoint_id: container.endpointId,
          container_id: container.name,
          compose_project: compose ?? undefined,
          repo_path: compose ? `${REPO_ROOT}/${compose}` : undefined,
          deploy_strategy: compose ? "compose_up" : "pull_restart",
        })
      );
      if (!result) break;
      if (result.success) added += 1;
      else failed += 1;
    }
    setAdding(false);
    if (added) {
      toast.success(`Added ${added} service${added === 1 ? "" : "s"}`, { description: failed ? `${failed} could not be added.` : undefined });
      router.push(projectId ? `/projects/${projectId}` : "/services");
      router.refresh();
    } else if (failed) {
      toast.error("No service was added", { description: "Check the logs for details." });
    }
  };

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await guard.run(() =>
      createServiceAction({
        project_id: projectId ?? undefined,
        name: manual.name,
        type: manual.type,
        url: manual.url || undefined,
        health_url: manual.health_url || undefined,
        container_id: manual.type === "docker" ? manual.container_id || undefined : undefined,
        compose_project: manual.type === "docker" ? manual.compose_project || undefined : undefined,
        repo_path: manual.type === "docker" ? manual.repo_path || undefined : undefined,
        deploy_strategy: manual.type === "docker" ? (manual.compose_project ? "compose_up" : "pull_restart") : "manual",
      })
    );
    setSaving(false);
    if (!result) return;
    if (result.success) {
      toast.success(`${manual.name} added`);
      router.push(projectId ? `/projects/${projectId}` : "/services");
      router.refresh();
    } else {
      setError(result.error ?? "Could not add the service");
    }
  };

  const type = TYPES.find((option) => option.value === manual.type)!;

  return (
    <>
      <Tabs defaultValue="host" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="host">
            <Server strokeWidth={1.75} />
            From the host
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Globe strokeWidth={1.75} />
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="host">
          <FormLayout
            rail={
              <Panel className="grid gap-3 p-3.5">
                <p className="text-[11px] font-medium text-fg-4">WHAT GETS ADDED</p>
                <p className="text-[13px] text-fg-2">
                  Picked containers become docker services of {projectName ? <span className="text-fg">{projectName}</span> : "no project"}, with their compose project and repository path filled
                  in, so deploys and restarts work straight away.
                </p>
                <div className="rounded-md border border-line p-3">
                  <p className="text-[11px] text-fg-3">Selected</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{selected.length}</p>
                  {selected.length > 0 && <p className="mt-1 truncate text-[11.5px] text-fg-3">{selected.map((container) => container.composeService ?? container.name).join(", ")}</p>}
                </div>
                <Button onClick={() => void addSelected()} disabled={selected.length === 0} loading={adding}>
                  Add {selected.length || ""} service{selected.length === 1 ? "" : "s"}
                </Button>
              </Panel>
            }
          >
            {loadingHost ? (
              <div className="grid gap-3">
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
              </div>
            ) : groups.length === 0 ? (
              <Panel>
                <EmptyState icon={Box} title="No containers found" description="Portainer returned nothing. Add the service manually, or check the Containers page." />
              </Panel>
            ) : (
              groups.map(([project, group]) => {
                const allPicked = group.every((container) => picked.has(container.id));
                return (
                  <FormSection
                    key={project}
                    title={project}
                    description={`${group.length} container${group.length === 1 ? "" : "s"} on the host`}
                  >
                    <div className="-mt-1 flex justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => toggleGroup(group)}>
                        {allPicked ? "Clear group" : "Select all"}
                      </Button>
                    </div>
                    <div className="grid gap-1.5">
                      {group.map((container) => {
                        const isPicked = picked.has(container.id);
                        return (
                          <button
                            key={container.id}
                            type="button"
                            onClick={() => toggle(container.id)}
                            aria-pressed={isPicked}
                            className={cn(
                              "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-quick ease-out",
                              isPicked ? "border-accent/40 bg-accent/[.07]" : "border-line hover:border-line-strong hover:bg-white/[.02]"
                            )}
                          >
                            <span className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] border", isPicked ? "border-accent bg-accent text-white" : "border-line-strong")}>
                              {isPicked && <Check className="size-3" strokeWidth={2.5} />}
                            </span>
                            <StatusDot status={container.state === "running" ? "ok" : "err"} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">{container.composeService ?? container.name}</span>
                              <span className="block truncate font-mono text-[11px] text-fg-3">{container.image}</span>
                            </span>
                            <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                              {container.ports.slice(0, 2).map((port) => (
                                <Chip key={port} mono>
                                  {port}
                                </Chip>
                              ))}
                              <Chip tone={container.state === "running" ? "ok" : "err"}>{container.status}</Chip>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </FormSection>
                );
              })
            )}
          </FormLayout>
        </TabsContent>

        <TabsContent value="manual">
          <form onSubmit={submitManual}>
            <FormLayout
              rail={
                <Panel className="grid gap-2.5 p-3.5">
                  <p className="text-[11px] font-medium text-fg-4">SERVICE TYPE</p>
                  <p className="text-[13px] text-fg-2">{type.blurb}</p>
                </Panel>
              }
            >
              {error && <p className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">{error}</p>}

              <FormSection title="Service" description="What kind of service this is and how it is called.">
                <div className="grid gap-2 sm:grid-cols-3">
                  {TYPES.map((option) => {
                    const Icon = option.icon;
                    const active = option.value === manual.type;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setManual((current) => ({ ...current, type: option.value }))}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors duration-quick ease-out",
                          active ? "border-accent/40 bg-accent/[.07] text-fg" : "border-line text-fg-2 hover:border-line-strong hover:bg-white/[.02]"
                        )}
                      >
                        <Icon className="size-4" strokeWidth={1.75} />
                        <span className="text-[13px] font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <FormField label="Service name" htmlFor="service-name" hint="Shown across the dashboard, e.g. api, web, worker.">
                  <Input id="service-name" value={manual.name} onChange={(event) => setManual((current) => ({ ...current, name: event.target.value }))} placeholder="api" required />
                </FormField>
              </FormSection>

              <FormSection title="Connection" description="Addresses used to reach and monitor the service.">
                <FormField label="URL" htmlFor="service-url">
                  <Input id="service-url" className="font-mono" value={manual.url} onChange={(event) => setManual((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.com" />
                </FormField>
                <FormField label="Health check URL" htmlFor="service-health" hint="Optional. Falls back to the URL above.">
                  <Input
                    id="service-health"
                    className="font-mono"
                    value={manual.health_url}
                    onChange={(event) => setManual((current) => ({ ...current, health_url: event.target.value }))}
                    placeholder="https://example.com/health"
                  />
                </FormField>
              </FormSection>

              {manual.type === "docker" && (
                <FormSection title="Docker" description="Where the container lives on the Pi.">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <FormField label="Container name" htmlFor="container-id">
                      <Input
                        id="container-id"
                        className="font-mono"
                        value={manual.container_id}
                        onChange={(event) => setManual((current) => ({ ...current, container_id: event.target.value }))}
                        placeholder="marczelloo-tools-app-1"
                      />
                    </FormField>
                    <FormField label="Compose project" htmlFor="compose-project">
                      <Input
                        id="compose-project"
                        className="font-mono"
                        value={manual.compose_project}
                        onChange={(event) =>
                          setManual((current) => ({ ...current, compose_project: event.target.value, repo_path: current.repo_path || (event.target.value ? `${REPO_ROOT}/${event.target.value}` : "") }))
                        }
                        placeholder="marczelloo-tools"
                      />
                    </FormField>
                  </div>
                  <FormField label="Repository path" htmlFor="repo-path" hint="Checkout on the Pi the agent deploys from.">
                    <Input id="repo-path" className="font-mono" value={manual.repo_path} onChange={(event) => setManual((current) => ({ ...current, repo_path: event.target.value }))} placeholder={`${REPO_ROOT}/…`} />
                  </FormField>
                </FormSection>
              )}

              <FormActions note={projectName ? `Added to ${projectName}` : "Added without a project"}>
                <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} disabled={!manual.name}>
                  Add service
                </Button>
              </FormActions>
            </FormLayout>
          </form>
        </TabsContent>
      </Tabs>
      {adding && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-3">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
          Adding services…
        </p>
      )}
      {guard.dialog}
    </>
  );
}
