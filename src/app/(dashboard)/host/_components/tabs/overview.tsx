"use client";

import Link from "next/link";
import { Activity, Boxes, CheckCircle2, Container, HardDrive, Network, ScrollText, Settings2, Thermometer } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, Meter, Panel } from "@/components/ui";
import { diskPercent, diskUsed, formatBytes, isPublic, loadPercent, memoryPercent, memoryUsed, type HostSummary } from "@/lib/host";
import { formatRelativeTime } from "@/lib/utils";
import { Sparkline } from "../sparkline";
import type { HostSample } from "../use-host";

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

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
      <span className="text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right tabular-nums">{children}</span>
    </div>
  );
}

/** The one screen to check when something feels off: what is wrong, how loaded it is, what to press. */
export function HostOverviewTab({ summary, history }: { summary: HostSummary; history: HostSample[] }) {
  const host = summary.host!;
  const exposed = host.publishedPorts.filter((port) => isPublic(port.hostIp));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card title="Needs attention" icon={Activity}>
          {summary.alerts.length === 0 ? (
            <div className="flex items-center gap-2.5 px-3.5 py-3 text-[13px] text-fg-2">
              <CheckCircle2 className="size-4 text-ok" strokeWidth={1.75} />
              Everything is within its limits.
            </div>
          ) : (
            summary.alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-2.5 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
                <StatusDot status={alert.tone} className="mt-[5px]" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{alert.title}</p>
                  <p className="text-[12px] text-fg-3">{alert.detail}</p>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card
          title="Load"
          icon={Thermometer}
          action={
            <Link href="/host?tab=resources" className="text-xs text-fg-3 hover:text-fg">
              Resources
            </Link>
          }
        >
          <div className="grid gap-4 p-3.5 sm:grid-cols-3">
            <div>
              <Meter label="CPU" value={loadPercent(host)} display={`${loadPercent(host)}%`} tone={loadPercent(host) > 85 ? "warn" : "neutral"} />
              <Sparkline values={history.map((sample) => sample.load)} tone={loadPercent(host) > 85 ? "warn" : "neutral"} className="mt-2" />
            </div>
            <div>
              <Meter label="Memory" value={memoryPercent(host)} display={formatBytes(memoryUsed(host))} tone={memoryPercent(host) > 88 ? "warn" : "neutral"} />
              <Sparkline values={history.map((sample) => sample.memory)} tone={memoryPercent(host) > 88 ? "warn" : "neutral"} className="mt-2" />
            </div>
            <div>
              <Meter
                label="Temperature"
                value={host.temperatureC ? Math.min(100, (host.temperatureC / 85) * 100) : 0}
                display={host.temperatureC === null ? "—" : `${host.temperatureC.toFixed(1)} °C`}
                tone={(host.temperatureC ?? 0) >= 70 ? "warn" : "neutral"}
              />
              <Sparkline
                values={history.map((sample) => sample.temperature ?? 0)}
                tone={(host.temperatureC ?? 0) >= 70 ? "warn" : "neutral"}
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        <Card
          title="Docker"
          icon={Container}
          action={
            <Link href="/host?tab=containers" className="text-xs text-fg-3 hover:text-fg">
              All containers
            </Link>
          }
        >
          <Fact label="Running">
            <span className="flex items-center justify-end gap-2">
              <StatusDot status="ok" />
              {host.docker?.running ?? 0}
            </span>
          </Fact>
          <Fact label="Stopped">
            <span className="flex items-center justify-end gap-2">
              {(host.docker?.stopped ?? 0) > 0 && <StatusDot status="warn" />}
              {host.docker?.stopped ?? 0}
            </span>
          </Fact>
          <Fact label="Images">{host.docker?.images ?? 0}</Fact>
          <Fact label="Build cache">{formatBytes(summary.agent?.buildCacheBytes ?? null)}</Fact>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card title="Quick actions" icon={Settings2}>
          <div className="grid gap-2 p-3.5">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/host?tab=containers">
                <Container strokeWidth={1.75} />
                Start, stop or restart a container
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/audit-log">
                <ScrollText strokeWidth={1.75} />
                What happened on this host
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/monitoring">
                <Activity strokeWidth={1.75} />
                Uptime and incidents
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/host?tab=settings">
                <Settings2 strokeWidth={1.75} />
                Host settings
              </Link>
            </Button>
          </div>
        </Card>

        <Card title="Storage" icon={HardDrive}>
          {host.disk ? (
            <>
              <div className="p-3.5">
                <Meter
                  label={host.disk.path}
                  value={diskPercent(host)}
                  display={`${formatBytes(diskUsed(host))} of ${formatBytes(host.disk.totalBytes)}`}
                  tone={diskPercent(host) >= 85 ? "warn" : "neutral"}
                />
              </div>
              <Fact label="Free">{formatBytes(host.disk.freeBytes)}</Fact>
              <Fact label="Build cache">{formatBytes(summary.agent?.buildCacheBytes ?? null)}</Fact>
            </>
          ) : (
            <Fact label="Disk">no reading</Fact>
          )}
        </Card>

        <Card
          title="Network"
          icon={Network}
          action={
            <Link href="/host?tab=ports" className="text-xs text-fg-3 hover:text-fg">
              All ports
            </Link>
          }
        >
          <Fact label="Published ports">{host.publishedPorts.length}</Fact>
          <Fact label="Reachable from the LAN">
            <span className="flex items-center justify-end gap-2">
              {exposed.length > 0 ? <Chip tone="warn">{exposed.length}</Chip> : <Chip tone="ok">none</Chip>}
            </span>
          </Fact>
          <Fact label="Everything else">loopback only, behind the tunnel</Fact>
        </Card>

        <Card title="Agent" icon={Boxes}>
          <Fact label="Reading taken">{formatRelativeTime(summary.generatedAt)}</Fact>
          <Fact label="Agent report">{summary.agent ? formatRelativeTime(summary.agent.generatedAt) : "not answering"}</Fact>
          <Fact label="Projects tracked">{summary.agent ? Object.keys(summary.agent.projects).length : 0}</Fact>
        </Card>
      </div>
    </div>
  );
}
