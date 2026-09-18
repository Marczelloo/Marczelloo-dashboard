"use client";

import { Loader2, RefreshCw, ServerCrash } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button, EmptyState, Panel } from "@/components/ui";
import { diskPercent, formatBytes, formatUptime, loadPercent, memoryPercent, type HostSummary } from "@/lib/host";
import { HostTabs, type HostTab } from "./host-tabs";
import { ContainersTab } from "./tabs/containers";
import { HostOverviewTab } from "./tabs/overview";
import { PortsTab } from "./tabs/ports";
import { ResourcesTab } from "./tabs/resources";
import { HostSettingsTab } from "./tabs/settings";
import { useHost } from "./use-host";

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5 text-[18px] font-semibold leading-tight tabular-nums">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

/** The Pi itself: what it is doing now, and the controls that reach it. */
export function HostView({ initial, tab }: { initial: HostSummary; tab: HostTab }) {
  const { summary, history, refreshing, refresh } = useHost(initial);
  const host = summary.host;
  const worst = summary.alerts.find((alert) => alert.tone === "err") ?? summary.alerts[0] ?? null;

  return (
    <>
      <PageHeader
        title={host?.hostname ?? "Host"}
        description={summary.reachable ? `Raspberry Pi · up ${host ? formatUptime(host.uptimeSeconds) : "—"}` : "The deploy agent is not answering"}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw strokeWidth={1.75} />}
            Refresh
          </Button>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {host ? (
          <>
            <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
              <Segment label="Health" detail={worst ? worst.title : "Nothing needs attention"}>
                <span className="flex items-center gap-2">
                  <StatusDot status={worst ? worst.tone : "ok"} size="lg" />
                  {worst ? (worst.tone === "err" ? "Degraded" : "Watch") : "Healthy"}
                </span>
              </Segment>
              <Segment label="CPU load" detail={`${host.loadavg[0].toFixed(2)} over ${host.cores} cores`}>
                {loadPercent(host)}%
              </Segment>
              <Segment label="Memory" detail={`${formatBytes(host.memory.availableBytes)} free of ${formatBytes(host.memory.totalBytes)}`}>
                {memoryPercent(host)}%
              </Segment>
              <Segment label="Temperature" detail={host.disk ? `Disk ${diskPercent(host)}% of ${formatBytes(host.disk.totalBytes)}` : "No disk reading"}>
                {host.temperatureC === null ? "—" : `${host.temperatureC.toFixed(1)} °C`}
              </Segment>
            </Panel>

            <HostTabs active={tab} />

            {tab === "overview" && <HostOverviewTab summary={summary} history={history} />}
            {tab === "resources" && <ResourcesTab summary={summary} history={history} />}
            {tab === "containers" && <ContainersTab />}
            {tab === "ports" && <PortsTab host={host} />}
            {tab === "settings" && <HostSettingsTab summary={summary} />}
          </>
        ) : (
          <Panel>
            <EmptyState
              icon={ServerCrash}
              title="The host is out of reach"
              description="The deploy agent did not answer. Check that it is running on the Pi and that AGENT_TOKEN is set for the dashboard."
              action={
                <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
                  Try again
                </Button>
              }
            />
          </Panel>
        )}
      </PageBody>
    </>
  );
}
