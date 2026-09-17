"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { browserStorage } from "@/components/layout/sidebar-preference";
import { readPinned, togglePinned } from "@/lib/pinned-projects";
import type { FleetRow } from "@/server/overview/types";
import { ProjectCard } from "./project-card";

type Filter = "all" | "issues" | "pinned";

const EMPTY: Record<Filter, { title: string; description: string }> = {
  all: { title: "No projects yet", description: "Create a project to deploy it straight from GitHub." },
  issues: { title: "Nothing needs attention", description: "Deploying, degraded or failing projects appear here." },
  pinned: { title: "No pinned projects", description: "Pin the ones you open most; they stay first in this list." },
};

function matches(row: FleetRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.name, row.slug, row.domain ?? "", row.description ?? "", ...row.tags].some((value) => value.toLowerCase().includes(needle));
}

export function ProjectsGrid({ rows }: { rows: FleetRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => setPinned(readPinned(browserStorage())), []);

  const issues = rows.filter((row) => row.attention);
  const ordered = useMemo(() => {
    const pinnedFirst = [...rows].sort((a, b) => Number(pinned.includes(b.projectId)) - Number(pinned.includes(a.projectId)));
    const scoped = filter === "issues" ? pinnedFirst.filter((row) => row.attention) : filter === "pinned" ? pinnedFirst.filter((row) => pinned.includes(row.projectId)) : pinnedFirst;
    return scoped.filter((row) => matches(row, query));
  }, [rows, pinned, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-sm border border-line bg-white/[.02] px-2.5 text-[13px] transition-colors duration-quick focus-within:border-accent/40 sm:max-w-[280px] sm:flex-none">
          <Search className="size-3.5 shrink-0 text-fg-4" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter projects…"
            aria-label="Filter projects"
            className="min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-4 focus:outline-none"
          />
        </label>
        <SegmentedControl<Filter>
          aria-label="Filter projects by state"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "issues", label: "Issues", count: issues.length },
            { value: "pinned", label: "Pinned", count: pinned.length },
          ]}
        />
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface bg-sheen shadow-inset-top">
          <EmptyState
            icon={FolderKanban}
            title={query ? "No project matches that filter" : EMPTY[filter].title}
            description={query ? `Nothing matches “${query}”.` : EMPTY[filter].description}
            action={
              !query && filter === "all" ? (
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/projects/new">New project</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((row) => (
            <ProjectCard
              key={row.projectId}
              row={row}
              pinned={pinned.includes(row.projectId)}
              onTogglePin={(id) => setPinned(togglePinned(browserStorage(), id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
