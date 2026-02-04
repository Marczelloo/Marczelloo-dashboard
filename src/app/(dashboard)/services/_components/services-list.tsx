"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import { Server, ExternalLink, FolderKanban, Globe, Database, Settings, Code, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const categoryConfig: Record<ServiceCategory, { icon: typeof Globe; label: string; color: string }> = {
  website: { icon: Globe, label: "Website", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  api: { icon: Code, label: "API", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  database: { icon: Database, label: "Database", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  admin: { icon: Settings, label: "Admin", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  other: { icon: Server, label: "Other", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

const typeColors: Record<string, string> = {
  docker: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  vercel: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  external: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

function ServiceCard({ service, project }: { service: Service; project?: Project }) {
  const category = detectServiceCategory(service);
  const CategoryIcon = categoryConfig[category].icon;

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CategoryIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
              {project && (
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <FolderKanban className="h-3 w-3" />
                  {project.name}
                </Link>
              )}
              {!project && <span className="text-xs text-muted-foreground">Standalone service</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge variant="outline" className={typeColors[service.type] || ""}>
              {service.type}
            </Badge>
            <Badge variant="outline" className={categoryConfig[category].color}>
              {categoryConfig[category].label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {service.url ? (
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {new URL(service.url).hostname}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">No URL configured</span>
          )}
          <Link href={`/services/${service.id}`}>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface ServicesListProps {
  standaloneServices: Service[];
  projectBoundServices: Service[];
  projects: Project[];
}

export function ServicesList({ standaloneServices, projectBoundServices, projects }: ServicesListProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");

  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const allServices = [...standaloneServices, ...projectBoundServices];

  // Apply filters
  const filteredServices = allServices.filter((service) => {
    // Type filter
    if (typeFilter !== "all" && service.type !== typeFilter) {
      return false;
    }

    // Category filter
    if (categoryFilter !== "all" && detectServiceCategory(service) !== categoryFilter) {
      return false;
    }

    // Ownership filter
    if (ownershipFilter === "standalone" && service.project_id) {
      return false;
    }
    if (ownershipFilter === "project" && !service.project_id) {
      return false;
    }

    return true;
  });

  const hasAnyServices = allServices.length > 0;
  const hasFilters = typeFilter !== "all" || categoryFilter !== "all" || ownershipFilter !== "all";

  if (!hasAnyServices) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No services configured yet.</p>
        <p className="mt-2 text-sm">Create a standalone service or add services to your projects.</p>
        <Link href="/services/new" className="mt-4 inline-block">
          <Button>
            <Server className="h-4 w-4 mr-2" />
            Create Service
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-secondary/30 rounded-lg">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-8">
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
          <SelectTrigger className="w-[140px] h-8">
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
          <SelectTrigger className="w-[140px] h-8">
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
            }}
          >
            Clear
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filteredServices.length} of {allServices.length} services
        </span>
      </div>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No services match the selected filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              project={service.project_id ? projectMap.get(service.project_id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
