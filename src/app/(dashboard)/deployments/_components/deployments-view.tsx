"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GitCommitHorizontal, Rocket } from "lucide-react";
import { DeployLogsButton } from "@/components/features/deploy-logs-button";
import { StatusDot } from "@/components/status-dot";
import { Chip, EmptyState, Panel, SegmentedControl, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SearchInput } from "@/components/ui";
import { formatDay, formatRelativeTime } from "@/lib/utils";
import type { Tone } from "@/lib/tone";
import { formatDeployDuration, type DeployList, type DeployRow } from "@/lib/deploys";
import type { DeployStatus } from "@/types";

const TONE: Record<DeployStatus, Tone> = { pending: "live", running: "live", success: "ok", failed: "err", cancelled: "idle" };
type Filter = "all" | "running" | "failed" | "success";

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

/** One day of deploys, headed by its date. */
function dayOf(row: DeployRow) {
  return row.startedAt.slice(0, 10);
}


/** Every deploy across every project, newest first. */
export function DeploymentsView({ data }: { data: DeployList }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [project, setProject] = useState("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: data.rows.length,
      running: data.rows.filter((row) => row.status === "running" || row.status === "pending").length,
      failed: data.rows.filter((row) => row.status === "failed").length,
      success: data.rows.filter((row) => row.status === "success").length,
    }),
    [data.rows]
  );

  const days = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = data.rows.filter((row) => {
      if (filter === "running" && row.status !== "running" && row.status !== "pending") return false;
      if (filter === "failed" && row.status !== "failed") return false;
      if (filter === "success" && row.status !== "success") return false;
      if (project !== "all" && row.projectId !== project) return false;
      return !needle || `${row.projectName ?? ""} ${row.serviceName ?? ""} ${row.commitSha ?? ""} ${row.triggeredBy}`.toLowerCase().includes(needle);
    });
    const byDay = new Map<string, DeployRow[]>();
    for (const row of visible) byDay.set(dayOf(row), [...(byDay.get(dayOf(row)) ?? []), row]);
    return [...byDay.entries()].map(([day, rows]) => ({ day, rows }));
  }, [data.rows, filter, project, query]);

  const visibleCount = days.reduce((total, group) => total + group.rows.length, 0);
  const last = data.rows[0] ?? null;

  return (
    <>
      <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
        <Segment label="Last deploy" detail={last ? `${last.projectName ?? last.serviceName ?? "unknown"} · ${last.triggeredBy}` : "Nothing recorded yet"}>
          {last ? (
            <span className="flex items-center gap-2">
              <StatusDot status={TONE[last.status]} />
              {formatRelativeTime(last.startedAt)}
            </span>
          ) : (
            "—"
          )}
        </Segment>
        <Segment label="Deploys · 7 days" detail={data.last7d.failed ? `${data.last7d.failed} failed` : "None failed"}>
          {data.last7d.total}
        </Segment>
        <Segment label="Running now" detail={data.running ? "The agent is working" : "Nothing in flight"}>
          <span className="flex items-center gap-2">
            {data.running > 0 && <StatusDot status="live" />}
            {data.running}
          </span>
        </Segment>
        <Segment label="Failures on record" detail={counts.failed ? "Open one to read its log" : "Clean history"}>
          {counts.failed}
        </Segment>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Filter>
          aria-label="Filter deploys"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "running", label: "Running", count: counts.running },
            { value: "failed", label: "Failed", count: counts.failed },
            { value: "success", label: "Succeeded", count: counts.success },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by project, sha or who" />
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
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
          <EmptyState
            icon={Rocket}
            title={data.rows.length ? "Nothing matches" : "No deploys yet"}
            description={data.rows.length ? "Loosen the filters to see the rest of the history." : "Push to a configured branch, or press Deploy on a project."}
          />
        </Panel>
      ) : (
        days.map((group) => (
          <Panel key={group.day}>
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-2.5">
              <h2 className="text-[13px] font-semibold">{formatDay(group.day)}</h2>
              <span className="font-mono text-[11px] text-fg-3">{group.rows.length}</span>
            </div>
            {group.rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
                <StatusDot status={TONE[row.status]} />
                {row.projectId ? (
                  <Link href={`/projects/${row.projectId}?tab=deployments`} className="w-[150px] min-w-0 truncate font-medium hover:underline">
                    {row.projectName}
                  </Link>
                ) : (
                  <span className="w-[150px] min-w-0 truncate font-medium text-fg-3">{row.serviceName ?? "unknown service"}</span>
                )}
                <code className="flex items-center gap-1 text-[12px] text-fg-2">
                  <GitCommitHorizontal className="size-3.5 text-fg-4" strokeWidth={1.75} />
                  {row.commitSha?.slice(0, 7) ?? "—"}
                </code>
                <span className="min-w-0 flex-1 truncate text-[12px] text-fg-3">{row.error ?? row.step ?? row.serviceName ?? ""}</span>
                <span className="flex basis-full items-center justify-end gap-2 pl-5 text-[11.5px] text-fg-3 sm:ml-auto sm:basis-auto sm:shrink-0 sm:pl-0">
                  <span className="mr-auto min-w-0 truncate sm:mr-0 sm:w-[150px] sm:text-right">{row.triggeredBy}</span>
                  <span className="w-[62px] text-right tabular-nums">{formatDeployDuration(row.durationMs)}</span>
                  <span className="w-[76px] truncate text-right text-fg-4">{formatRelativeTime(row.startedAt)}</span>
                  {row.status === "failed" || row.status === "running" ? <Chip tone={TONE[row.status]}>{row.step ?? row.status}</Chip> : null}
                  <DeployLogsButton logFile={row.logsKey ?? ""} deployId={row.id} serviceName={row.serviceName ?? "service"} hasLogFile={Boolean(row.logsKey)} />
                </span>
              </div>
            ))}
          </Panel>
        ))
      )}
    </>
  );
}
