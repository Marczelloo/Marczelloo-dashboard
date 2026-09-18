"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Search, Server } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, EmptyState, Input, Panel, SegmentedControl, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import type { ServiceList, ServiceRow } from "@/server/services/list";

type Filter = "all" | "docker" | "vercel" | "external";
const STANDALONE = "standalone";

const toneOf = (row: ServiceRow) => (row.running === null ? "idle" : row.running ? "ok" : "err");
const stateOf = (row: ServiceRow) => (row.type !== "docker" ? "external" : (row.containerStatus ?? "unknown"));

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

/** Every service the dashboard knows, grouped by the project that owns it. */
export function ServicesList({ data }: { data: ServiceList }) {
  const [type, setType] = useState<Filter>("all");
  const [project, setProject] = useState("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: data.rows.length,
      docker: data.rows.filter((row) => row.type === "docker").length,
      vercel: data.rows.filter((row) => row.type === "vercel").length,
      external: data.rows.filter((row) => row.type === "external").length,
      running: data.rows.filter((row) => row.running === true).length,
      down: data.rows.filter((row) => row.running === false).length,
    }),
    [data.rows]
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = data.rows.filter((row) => {
      if (type !== "all" && row.type !== type) return false;
      if (project === STANDALONE && row.projectId) return false;
      if (project !== "all" && project !== STANDALONE && row.projectId !== project) return false;
      return !needle || `${row.name} ${row.url ?? ""} ${row.composeProject ?? ""}`.toLowerCase().includes(needle);
    });
    const byProject = new Map<string, ServiceRow[]>();
    for (const row of visible) {
      const key = row.projectName ?? "Standalone";
      byProject.set(key, [...(byProject.get(key) ?? []), row]);
    }
    return [...byProject.entries()]
      .map(([name, rows]) => ({ name, rows: [...rows].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => (a.name === "Standalone" ? 1 : b.name === "Standalone" ? -1 : a.name.localeCompare(b.name)));
  }, [data.rows, project, query, type]);

  const visibleCount = groups.reduce((total, group) => total + group.rows.length, 0);

  if (data.rows.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Server}
          title="No services yet"
          description="A service is one container, deployment or address this dashboard watches. Add one to a project, or on its own."
          action={
            <Button size="sm" asChild>
              <Link href="/services/new">
                <Plus strokeWidth={1.75} />
                Add service
              </Link>
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
        <Segment label="Services" detail={`${counts.docker} docker · ${counts.vercel + counts.external} elsewhere`}>
          {counts.all}
        </Segment>
        <Segment label="Running" detail={data.live ? "Reported by the agent" : "The agent is not answering"}>
          <span className="flex items-center gap-2">
            <StatusDot status="ok" />
            {counts.running}
          </span>
        </Segment>
        <Segment label="Stopped" detail={counts.down ? "Needs a look" : "Nothing is down"}>
          <span className="flex items-center gap-2">
            {counts.down > 0 && <StatusDot status="err" />}
            {counts.down}
          </span>
        </Segment>
        <Segment label="Projects" detail="Services can also stand alone">
          {data.projects.length}
        </Segment>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Filter>
          aria-label="Filter by type"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "docker", label: "Docker", count: counts.docker },
            { value: "vercel", label: "Vercel", count: counts.vercel },
            { value: "external", label: "External", count: counts.external },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Search className="size-4 text-fg-4" strokeWidth={1.75} />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" className="h-8 w-[190px]" aria-label="Search services" />
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-8 w-[190px]" aria-label="Filter by project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value={STANDALONE}>Standalone</SelectItem>
              {data.projects.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleCount === 0 ? (
        <Panel>
          <EmptyState icon={Server} title="Nothing matches" description="Loosen the filters to see the rest of the services." />
        </Panel>
      ) : (
        groups.map((group) => (
          <Panel key={group.name}>
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-2.5">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                <Server className="size-4 text-fg-3" strokeWidth={1.75} />
                {group.name}
              </h2>
              <span className="font-mono text-[11px] text-fg-3">{group.rows.length}</span>
            </div>
            {group.rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
                <StatusDot status={toneOf(row)} />
                <Link href={`/services/${row.id}`} className="min-w-0 truncate text-[13px] font-medium hover:underline">
                  {row.name}
                </Link>
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 truncate font-mono text-[11.5px] text-fg-3 hover:text-fg">
                    {row.url}
                    <ExternalLink className="size-3 shrink-0" strokeWidth={1.75} />
                  </a>
                ) : (
                  <span className="truncate font-mono text-[11.5px] text-fg-4">{row.containerId ?? "no address"}</span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {row.restarts > 0 && <Chip tone="warn">{row.restarts} restarts</Chip>}
                  <Chip mono>{row.type}</Chip>
                  <Chip tone={toneOf(row) === "idle" ? "idle" : toneOf(row)}>{stateOf(row)}</Chip>
                </span>
              </div>
            ))}
          </Panel>
        ))
      )}
    </div>
  );
}
