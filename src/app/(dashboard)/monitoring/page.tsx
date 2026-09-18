import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Activity, AlertTriangle, ExternalLink, Globe, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, EmptyState, Panel } from "@/components/ui";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { formatRelativeTime } from "@/lib/utils";
import type { Tone } from "@/lib/tone";
import { requireAuth } from "@/server/lib/auth";
import { getMonitorSummary, groupByProject, type MonitorTargetRow } from "@/server/monitor/summary";
import { runMonitoring } from "@/server/monitoring";
import { formatDuration } from "@/server/monitoring/state-machine";
import type { MonitorStatus } from "@/server/monitoring/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitoring" };

const TONE: Record<MonitorStatus, Tone> = { ok: "ok", warning: "warn", down: "err", unknown: "idle" };
const LABEL: Record<MonitorStatus, string> = { ok: "up", warning: "degraded", down: "down", unknown: "not checked" };

async function runChecks() {
  "use server";
  if (!checkDemoModeBlocked().blocked) {
    try {
      await requireAuth();
      await runMonitoring();
    } catch (error) {
      console.error("[monitoring] Failed to run the checks:", error);
    }
  }
  revalidatePath("/monitoring");
}

function Card({ title, icon: Icon, action, children }: { title: string; icon: typeof Activity; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-3">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Icon className="size-4 text-fg-3" strokeWidth={1.75} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Panel>
  );
}

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

function TargetRow({ target }: { target: MonitorTargetRow }) {
  const containers = target.containers.filter((container) => container.status !== "running");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
      <StatusDot status={TONE[target.status]} />
      <span className="min-w-0 truncate font-medium">{target.label}</span>
      {target.lastError && target.status !== "ok" && <span className="min-w-0 truncate text-[12px] text-fg-3">{target.lastError}</span>}
      {target.kind === "containers" && containers.length > 0 && (
        <span className="min-w-0 truncate text-[12px] text-fg-3">
          {containers.map((container) => `${container.name}: ${container.status}`).join(" · ")}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2 text-[11.5px] text-fg-3">
        {target.latencyMs !== null && <span className="tabular-nums">{target.latencyMs} ms</span>}
        {target.sslDaysLeft !== null && (
          <Chip tone={target.sslDaysLeft > 30 ? "neutral" : target.sslDaysLeft > 14 ? "warn" : "err"}>SSL {target.sslDaysLeft} d</Chip>
        )}
        <span className="w-[112px] truncate text-right">
          {LABEL[target.status]} for {formatRelativeTime(target.since).replace(" ago", "")}
        </span>
      </span>
    </div>
  );
}

export default async function MonitoringPage() {
  const summary = await getMonitorSummary().catch(() => null);

  if (!summary) {
    return (
      <>
        <PageHeader title="Monitoring" description="Domains, containers and certificates" />
        <PageBody>
          <Panel>
            <EmptyState icon={AlertTriangle} title="Monitoring is unavailable" description="The database did not answer. Reload in a moment." />
          </Panel>
        </PageBody>
      </>
    );
  }

  const problems = summary.targets.filter((target) => target.status === "down" || target.status === "warning");
  const open = summary.incidents.filter((incident) => incident.open);
  const groups = groupByProject(summary.targets);
  const certificates = summary.targets.filter((target) => target.sslDaysLeft !== null).sort((a, b) => (a.sslDaysLeft ?? 0) - (b.sslDaysLeft ?? 0));
  const soonest = certificates[0]?.sslDaysLeft ?? null;

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="What the Pi serves, checked on a loop"
        actions={
          <form action={runChecks}>
            <Button variant="secondary" size="sm" type="submit">
              <RefreshCw strokeWidth={1.75} />
              Run checks
            </Button>
          </form>
        }
      />

      <PageBody className="flex flex-col gap-4">
        <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
          <Segment label="Targets" detail={`Checked ${summary.targets[0]?.lastCheckedAt ? formatRelativeTime(summary.targets[0].lastCheckedAt) : "not yet"}`}>
            {summary.targets.length}
          </Segment>
          <Segment label="Problems now" detail={problems.length ? problems.map((target) => target.label).join(", ") : "Everything answers"}>
            <span className="flex items-center gap-2">
              {problems.length > 0 && <StatusDot status={problems.some((target) => target.status === "down") ? "err" : "warn"} />}
              {problems.length}
            </span>
          </Segment>
          <Segment label="Open incidents" detail={open.length ? `Oldest ${formatRelativeTime(open[open.length - 1].started_at)}` : "None open"}>
            {open.length}
          </Segment>
          <Segment label="Nearest certificate" detail={certificates[0] ? certificates[0].label : "No certificate seen"}>
            {soonest === null ? "—" : `${soonest} d`}
          </Segment>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            {groups.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={Globe}
                  title="Nothing is being checked yet"
                  description="The loop picks up domains and containers once a project has one; press Run checks to do a round now."
                />
              </Panel>
            ) : (
              groups.map((group) => (
                <Card key={group.name} title={group.name} icon={Globe}>
                  {group.rows.map((target) => (
                    <TargetRow key={target.key} target={target} />
                  ))}
                </Card>
              ))
            )}

            {summary.services.length > 0 && (
              <Card title="Uptime · 24 h" icon={Activity}>
                {summary.services.map((service) => (
                  <div key={service.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
                    <StatusDot status={service.checks === 0 ? "idle" : service.lastOk ? "ok" : "err"} />
                    <Link href={`/services/${service.id}`} className="min-w-0 truncate font-medium hover:underline">
                      {service.name}
                    </Link>
                    {service.url && (
                      <a href={service.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 truncate font-mono text-[11.5px] text-fg-3 hover:text-fg">
                        {service.url}
                        <ExternalLink className="size-3 shrink-0" strokeWidth={1.75} />
                      </a>
                    )}
                    <span className="ml-auto flex shrink-0 items-center gap-3 text-[11.5px] text-fg-3 tabular-nums">
                      <span className="w-[70px] text-right">{service.avgLatency > 0 ? `${Math.round(service.avgLatency)} ms` : "—"}</span>
                      <span className="w-[62px] text-right">{service.checks > 0 ? `${service.uptime.toFixed(1)}%` : "—"}</span>
                      <span className="w-[86px] truncate text-right text-fg-4">{service.lastCheckedAt ? formatRelativeTime(service.lastCheckedAt) : "never"}</span>
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <Card title="Platform" icon={HardDrive}>
              {summary.platform.length === 0 ? (
                <EmptyState icon={HardDrive} title="No platform check yet" description="The agent and the disk are checked on the same loop." className="py-6" />
              ) : (
                summary.platform.map((target) => (
                  <div key={target.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
                    <StatusDot status={TONE[target.status]} />
                    <span className="min-w-0 truncate font-medium">{target.label}</span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-fg-3">
                      {target.kind === "disk" && target.freePercent !== null ? `${target.freePercent}% free` : LABEL[target.status]}
                    </span>
                  </div>
                ))
              )}
            </Card>

            <Card
              title="Incidents"
              icon={AlertTriangle}
              action={
                <Link href="/audit-log" className="text-xs text-fg-3 hover:text-fg">
                  Audit log
                </Link>
              }
            >
              {summary.incidents.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No incidents" description="Nothing has gone down since the loop started watching." className="py-6" />
              ) : (
                summary.incidents.map((incident) => (
                  <div key={incident.id} className="flex flex-col gap-1 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
                    <p className="flex flex-wrap items-center gap-2 text-[13px]">
                      <StatusDot status={incident.severity === "down" ? "err" : "warn"} />
                      <span className="min-w-0 truncate font-medium">{incident.label}</span>
                      {incident.open && <Chip tone="live">open</Chip>}
                    </p>
                    <p className="truncate text-[11.5px] text-fg-3">
                      {incident.reason ?? "no reason recorded"} · {formatRelativeTime(incident.started_at)}
                      {!incident.open && incident.ended_at ? ` · lasted ${formatDuration(incident.started_at, incident.ended_at)}` : ""}
                    </p>
                  </div>
                ))
              )}
            </Card>

            {certificates.length > 0 && (
              <Card title="Certificates" icon={ShieldCheck}>
                {certificates.map((target) => (
                  <div key={`tls-${target.key}`} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
                    <span className="min-w-0 truncate font-mono text-[12px]">{target.label}</span>
                    <Chip tone={(target.sslDaysLeft ?? 0) > 30 ? "neutral" : (target.sslDaysLeft ?? 0) > 14 ? "warn" : "err"} className="ml-auto">
                      {target.sslDaysLeft} d left
                    </Chip>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
