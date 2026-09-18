"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusDot } from "@/components/status-dot";
import { Server } from "lucide-react";
import type { Service, Project } from "@/types";

type ServiceCategory = "website" | "api" | "database" | "admin" | "other";

// Detect service category from URL and name patterns
function detectServiceCategory(service: Service): ServiceCategory {
  const name = service.name.toLowerCase();
  const url = service.url?.toLowerCase() || "";

  // Database patterns
  if (
    name.includes("postgres") ||
    name.includes("mysql") ||
    name.includes("mongo") ||
    name.includes("redis") ||
    name.includes("mariadb") ||
    name.includes("minio") ||
    name.includes("database") ||
    name.includes("db") ||
    url.includes(":5432") ||
    url.includes(":3306") ||
    url.includes(":27017") ||
    url.includes(":6379")
  ) {
    return "database";
  }

  // Admin/Dashboard patterns
  if (
    name.includes("portainer") ||
    name.includes("grafana") ||
    name.includes("prometheus") ||
    name.includes("traefik") ||
    name.includes("adminer") ||
    name.includes("pgadmin") ||
    name.includes("kibana") ||
    name.includes("dashboard") ||
    name.includes("monitoring") ||
    url.includes("portainer") ||
    url.includes("grafana")
  ) {
    return "admin";
  }

  // API patterns
  if (
    name.includes("api") ||
    name.includes("backend") ||
    name.includes("server") ||
    name.includes("hub") ||
    url.includes("/api") ||
    url.includes("/v1") ||
    url.includes("/v2") ||
    url.includes("/graphql") ||
    url.includes("swagger") ||
    url.includes(":3001") ||
    url.includes(":8080") ||
    url.includes(":4000")
  ) {
    return "api";
  }

  // Website patterns (default for things with URLs)
  if (
    service.url ||
    name.includes("web") ||
    name.includes("frontend") ||
    name.includes("site") ||
    name.includes("app") ||
    service.type === "vercel"
  ) {
    return "website";
  }

  return "other";
}

function serviceStatus(service: Service) {
  return service.type === "docker" ? "idle" : "ok";
}

interface ServicesListProps {
  standaloneServices: Service[];
  projectBoundServices: Service[];
  projects: Project[];
}

export function ServicesList({
  standaloneServices,
  projectBoundServices,
  projects,
}: ServicesListProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const projectMap = useMemo(
    () =>
      new Map<string, Project>(
        projects.map((project) => [project.id, project]),
      ),
    [projects],
  );
  const allServices = [...standaloneServices, ...projectBoundServices];

  // Apply filters
  const filteredServices = allServices.filter((service) => {
    // Type filter
    if (typeFilter !== "all" && service.type !== typeFilter) {
      return false;
    }

    // Category filter
    if (
      categoryFilter !== "all" &&
      detectServiceCategory(service) !== categoryFilter
    ) {
      return false;
    }

    // Ownership filter
    if (ownershipFilter === "standalone" && service.project_id) {
      return false;
    }
    if (ownershipFilter === "project" && !service.project_id) {
      return false;
    }

    return `${service.name} ${service.url ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const hasAnyServices = allServices.length > 0;
  const hasFilters =
    typeFilter !== "all" ||
    categoryFilter !== "all" ||
    ownershipFilter !== "all" ||
    query;
  const groupedServices = useMemo(() => {
    const groups = new Map<string, Service[]>();
    for (const service of filteredServices) {
      const project = service.project_id
        ? projectMap.get(service.project_id)
        : undefined;
      const groupName = project?.name ?? "Standalone";
      groups.set(groupName, [...(groups.get(groupName) ?? []), service]);
    }
    return [...groups.entries()];
  }, [filteredServices, projectMap]);

  if (!hasAnyServices) {
    return (
      <Panel>
        <EmptyState
          icon={Server}
          title="No services configured yet"
          description="Create a standalone service or add services to your projects."
          action={
            <Link href="/services/new">
              <Button>Add service</Button>
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name or URL"
          className="w-full sm:w-[220px]"
        />

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="docker">Docker</SelectItem>
            <SelectItem value="vercel">Vercel</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="database">Database</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ownership" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            <SelectItem value="standalone">Standalone</SelectItem>
            <SelectItem value="project">Project-bound</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter("all");
              setCategoryFilter("all");
              setOwnershipFilter("all");
              setQuery("");
            }}
          >
            Clear
          </Button>
        )}

        <span className="ml-auto text-[12px] text-fg-3">
          {filteredServices.length} of {allServices.length} services
        </span>
      </div>

      {filteredServices.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Server}
            title="No services match the filters"
            description="Adjust or clear the filters to see services."
          />
        </Panel>
      ) : (
        groupedServices.map(([groupName, group]) => (
          <Panel key={groupName} className="overflow-hidden">
            <div className="border-b border-line-subtle px-3.5 py-3">
              <h2 className="text-[13.5px] font-semibold text-fg">
                {groupName}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-fg-3">
                {group.length} service{group.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="divide-y divide-line-subtle">
              {group.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-wrap items-center gap-3 px-3.5 py-3"
                >
                  <StatusDot
                    status={serviceStatus(service)}
                    label={
                      service.type === "docker"
                        ? "Container status unavailable"
                        : "Available"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/services/${service.id}`}
                      className="block truncate text-[13px] font-medium text-fg hover:text-accent-text"
                    >
                      {service.name}
                    </Link>
                    <p className="truncate font-mono text-[11.5px] text-fg-3">
                      {service.url ?? "No URL configured"}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Chip mono>{service.type}</Chip>
                    <Chip tone={service.type === "docker" ? "idle" : "ok"}>
                      {service.type === "docker" ? "Unknown" : "External"}
                    </Chip>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/services/${service.id}`}>View details</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}
