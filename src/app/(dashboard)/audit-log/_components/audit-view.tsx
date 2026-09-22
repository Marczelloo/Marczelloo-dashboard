"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, History, Loader2, RefreshCw, Search } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, EmptyState, Input, Panel, SegmentedControl, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { AUDIT_CATEGORIES, toCsv, type AuditCategory, type AuditList, type AuditRow, type AuditTone } from "@/lib/audit";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Category = "all" | AuditCategory;
type Range = "24h" | "7d" | "30d" | "all";

const RANGE_MS: Record<Range, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, all: Number.POSITIVE_INFINITY };
const DOT: Record<AuditTone, "ok" | "warn" | "err" | "idle"> = { ok: "ok", warn: "warn", err: "err", neutral: "idle" };
const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

function localDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Entry({ row }: { row: AuditRow }) {
  const [open, setOpen] = useState(false);
  const expandable = row.details.length > 0;

  return (
    <div className="[&+&]:border-t [&+&]:border-line-subtle">
      <div
        className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-[13px]", expandable && "cursor-pointer hover:bg-white/[.015]")}
        onClick={expandable ? () => setOpen((value) => !value) : undefined}
      >
        <span className="w-[42px] shrink-0 font-mono text-[11.5px] tabular-nums text-fg-4">{TIME.format(new Date(row.at))}</span>
        <StatusDot status={DOT[row.tone]} />
        <span className="min-w-[55%] flex-1 truncate sm:min-w-0">
          <span className="font-medium">{row.verb}</span>
          {row.subject && (
            <>
              <span className="text-fg-4"> · </span>
              {row.href ? (
                <Link href={row.href} onClick={(event) => event.stopPropagation()} className="text-fg-2 hover:text-fg hover:underline">
                  {row.subject}
                </Link>
              ) : (
                <span className="text-fg-2">{row.subject}</span>
              )}
            </>
          )}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-[11.5px] text-fg-3">
          {row.tone === "err" && <Chip tone="err">attention</Chip>}
          <span className="max-w-[180px] truncate">{row.actor}</span>
          <span className="w-[72px] truncate text-right text-fg-4">{formatRelativeTime(row.at)}</span>
          <span className="flex size-5 items-center justify-center">
            {expandable && (
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? "Hide details" : "Show details"}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((value) => !value);
                }}
                className="flex size-5 items-center justify-center rounded-sm text-fg-4 hover:text-fg-2"
              >
                <ChevronRight className={cn("size-3.5 transition-transform duration-quick", open && "rotate-90")} strokeWidth={1.75} />
              </button>
            )}
          </span>
        </span>
      </div>
      {open && (
        <dl className="mx-3.5 mb-3 ml-[72px] grid gap-x-4 gap-y-1 rounded-md border border-line-subtle bg-canvas px-3 py-2 text-[12px] sm:grid-cols-[140px_minmax(0,1fr)]">
          {row.details.map((detail) => (
            <Fragment key={detail.key}>
              <dt className="text-fg-3">{detail.key}</dt>
              <dd className={cn("break-all font-mono text-[11.5px]", detail.value === "hidden" ? "italic text-fg-4" : "text-fg-2")}>{detail.value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Everything done through the dashboard, filterable and exportable. */
export function AuditView({ data }: { data: AuditList }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [category, setCategory] = useState<Category>("all");
  const [range, setRange] = useState<Range>("7d");
  const [actor, setActor] = useState("all");
  const [project, setProject] = useState("all");
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());

  const inRange = useMemo(() => data.rows.filter((row) => now - Date.parse(row.at) <= RANGE_MS[range]), [data.rows, now, range]);

  const counts = useMemo(() => {
    const result: Record<Category, number> = { all: inRange.length, deploys: 0, changes: 0, secrets: 0, containers: 0, access: 0, github: 0 };
    for (const row of inRange) result[row.category] += 1;
    return result;
  }, [inRange]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inRange.filter((row) => {
      if (category !== "all" && row.category !== category) return false;
      if (actor !== "all" && row.actor !== actor) return false;
      if (project !== "all" && row.projectId !== project) return false;
      return !needle || `${row.verb} ${row.subject ?? ""} ${row.actor} ${row.details.map((detail) => detail.value).join(" ")}`.toLowerCase().includes(needle);
    });
  }, [inRange, category, actor, project, query]);

  const days = useMemo(() => {
    const byDay = new Map<string, AuditRow[]>();
    for (const row of visible) byDay.set(localDay(row.at), [...(byDay.get(localDay(row.at)) ?? []), row]);
    return [...byDay.entries()].map(([day, rows]) => ({ day, rows }));
  }, [visible]);

  const summary = useMemo(() => {
    const today = data.rows.filter((row) => now - Date.parse(row.at) <= RANGE_MS["24h"]);
    const week = data.rows.filter((row) => now - Date.parse(row.at) <= RANGE_MS["7d"]);
    return {
      today: today.length,
      week: week.length,
      people: new Set(week.map((row) => row.actor)).size,
      flagged: week.filter((row) => row.tone === "err").length,
      reveals: week.filter((row) => row.action === "reveal_secret").length,
    };
  }, [data.rows, now]);

  function exportCsv() {
    const blob = new Blob([toCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const last = data.rows[0] ?? null;

  return (
    <>
      <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
        <Segment label="Last event" detail={last ? `${last.verb} · ${last.actor}` : "Nothing recorded yet"}>
          {last ? formatRelativeTime(last.at) : "—"}
        </Segment>
        <Segment label="Last 24 hours" detail={`${summary.week} in the last 7 days`}>
          {summary.today}
        </Segment>
        <Segment label="Worth a look · 7 days" detail={summary.flagged ? "Deletes, refusals, wrong PINs, failures" : "Nothing unusual"}>
          <span className="flex items-center gap-2">
            {summary.flagged > 0 && <StatusDot status="err" />}
            {summary.flagged}
          </span>
        </Segment>
        <Segment label="Variables revealed · 7 days" detail={`${summary.people} ${summary.people === 1 ? "person" : "people"} active this week`}>
          {summary.reveals}
        </Segment>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Category>
          aria-label="Filter by kind"
          value={category}
          onChange={setCategory}
          options={[{ value: "all", label: "All", count: counts.all }, ...AUDIT_CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label, count: counts[entry.value] }))]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing} aria-label="Refresh">
            {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw strokeWidth={1.75} />}
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
            <Download strokeWidth={1.75} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Search className="size-4 text-fg-4" strokeWidth={1.75} />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, names, commands" className="h-8 w-[240px]" aria-label="Search events" />
        <Select value={range} onValueChange={(value) => setRange(value as Range)}>
          <SelectTrigger className="h-8 w-[140px]" aria-label="Time range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">Everything kept</SelectItem>
          </SelectContent>
        </Select>
        {data.projects.length > 0 && (
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-8 w-[170px]" aria-label="Filter by project">
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
        )}
        {data.actors.length > 1 && (
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="h-8 w-[200px]" aria-label="Filter by who">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {data.actors.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {days.length === 0 ? (
        <Panel>
          <EmptyState
            icon={History}
            title={data.rows.length ? "Nothing matches" : "No events yet"}
            description={data.rows.length ? "Widen the time range or loosen the filters." : "Deploys, changes, revealed variables and console commands will appear here."}
          />
        </Panel>
      ) : (
        days.map((group) => (
          <Panel key={group.day}>
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-2.5">
              <h2 className="text-[13px] font-semibold">{DAY.format(new Date(`${group.day}T12:00:00`))}</h2>
              <span className="font-mono text-[11px] text-fg-3">{group.rows.length}</span>
            </div>
            {group.rows.map((row) => (
              <Entry key={row.id} row={row} />
            ))}
          </Panel>
        ))
      )}
      {data.rows.length >= 500 && <p className="text-center text-[11.5px] text-fg-4">Showing the latest 500 events.</p>}
    </>
  );
}
