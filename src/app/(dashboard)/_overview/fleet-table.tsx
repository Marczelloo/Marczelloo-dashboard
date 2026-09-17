"use client";

import { useEffect, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Overview } from "@/server/overview/types";
import { FLEET_COLUMNS, FleetRow } from "./fleet-row";

type Filter = "all" | "issues";

export function FleetTable({ overview }: { overview: Overview }) {
  const [filter, setFilter] = useState<Filter>("all");
  const issues = overview.fleet.filter((row) => row.attention);
  const rows = filter === "issues" ? issues : overview.fleet;
  // Rows stagger in on the first render only; later mounts (filtering) appear at once.
  const [stagger, setStagger] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setStagger(false), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-3">
        <h2 className="text-[13.5px] font-semibold">Projects</h2>
        <SegmentedControl<Filter>
          aria-label="Filter projects"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: overview.fleet.length },
            { value: "issues", label: "Issues", count: issues.length },
          ]}
        />
      </div>
      <div className={cn("hidden min-h-[34px] items-center gap-4 px-3.5 text-[11px] font-medium text-fg-4 md:grid", FLEET_COLUMNS)}>
        <span>Project</span>
        <span>Uptime · 24 h</span>
        <span>Containers</span>
        <span>Last deploy</span>
        <span />
      </div>
      {issues.length === 0 && overview.fleet.length > 0 && (
        <div className="flex min-h-[44px] items-center gap-2.5 border-t border-line-subtle px-3.5 text-[13px] text-fg-2">
          <StatusDot status="ok" />
          <span>
            <span className="font-medium text-fg">All systems normal</span> · {overview.domains.up} domains up
          </span>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filter === "issues" ? "Nothing needs attention" : "No projects yet"}
          description={filter === "issues" ? "Deploying or failing projects appear here." : "Create a project to deploy it from GitHub."}
          action={filter === "all" ? <Button size="sm" variant="secondary" asChild><Link href="/projects/new">New project</Link></Button> : undefined}
          className="border-t border-line-subtle"
        />
      ) : (
        <LayoutGroup>
          {rows.map((row, index) => (
            <FleetRow key={row.projectId} row={row} enterDelay={stagger ? Math.min(index, 8) * 0.03 : 0} />
          ))}
        </LayoutGroup>
      )}
    </Panel>
  );
}
