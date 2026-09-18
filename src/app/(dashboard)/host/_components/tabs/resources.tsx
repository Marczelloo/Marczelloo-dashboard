"use client";

import { Cpu, HardDrive, MemoryStick, Thermometer } from "lucide-react";
import { Meter, Panel } from "@/components/ui";
import { diskPercent, diskUsed, formatBytes, formatUptime, loadPercent, memoryPercent, memoryUsed, type HostSummary } from "@/lib/host";
import { Sparkline } from "../sparkline";
import type { HostSample } from "../use-host";

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Cpu; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="flex items-center gap-2 border-b border-line-subtle px-3.5 py-3">
        <Icon className="size-4 text-fg-3" strokeWidth={1.75} />
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
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

/** The numbers behind the strip, plus how they moved while this page was open. */
export function ResourcesTab({ summary, history }: { summary: HostSummary; history: HostSample[] }) {
  const host = summary.host!;
  const window = history.length > 1 ? `last ${Math.round(((history[history.length - 1].at - history[0].at) / 60_000) * 10) / 10} min` : "collecting";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="CPU" icon={Cpu}>
        <div className="p-3.5">
          <Meter label={`Load · ${window}`} value={loadPercent(host)} display={`${loadPercent(host)}%`} tone={loadPercent(host) > 85 ? "warn" : "neutral"} />
          <Sparkline values={history.map((sample) => sample.load)} tone={loadPercent(host) > 85 ? "warn" : "neutral"} className="mt-2" />
        </div>
        <Fact label="Load 1 min">{host.loadavg[0].toFixed(2)}</Fact>
        <Fact label="Load 5 min">{host.loadavg[1].toFixed(2)}</Fact>
        <Fact label="Load 15 min">{host.loadavg[2].toFixed(2)}</Fact>
        <Fact label="Cores">{host.cores}</Fact>
      </Card>

      <Card title="Memory" icon={MemoryStick}>
        <div className="p-3.5">
          <Meter label={`In use · ${window}`} value={memoryPercent(host)} display={`${memoryPercent(host)}%`} tone={memoryPercent(host) > 88 ? "warn" : "neutral"} />
          <Sparkline values={history.map((sample) => sample.memory)} tone={memoryPercent(host) > 88 ? "warn" : "neutral"} className="mt-2" />
        </div>
        <Fact label="Total">{formatBytes(host.memory.totalBytes)}</Fact>
        <Fact label="Used">{formatBytes(memoryUsed(host))}</Fact>
        <Fact label="Available">{formatBytes(host.memory.availableBytes)}</Fact>
      </Card>

      <Card title="Temperature" icon={Thermometer}>
        <div className="p-3.5">
          <Meter
            label={`Against the 85 °C ceiling · ${window}`}
            value={host.temperatureC ? Math.min(100, (host.temperatureC / 85) * 100) : 0}
            display={host.temperatureC === null ? "—" : `${host.temperatureC.toFixed(1)} °C`}
            tone={(host.temperatureC ?? 0) >= 70 ? "warn" : "neutral"}
          />
          <Sparkline values={history.map((sample) => sample.temperature ?? 0)} tone={(host.temperatureC ?? 0) >= 70 ? "warn" : "neutral"} className="mt-2" />
        </div>
        <Fact label="Throttles at">80 °C</Fact>
        <Fact label="Samples this session">{history.length}</Fact>
      </Card>

      <Card title="Storage" icon={HardDrive}>
        {host.disk ? (
          <>
            <div className="p-3.5">
              <Meter label={host.disk.path} value={diskPercent(host)} display={`${diskPercent(host)}%`} tone={diskPercent(host) >= 85 ? "warn" : "neutral"} />
            </div>
            <Fact label="Total">{formatBytes(host.disk.totalBytes)}</Fact>
            <Fact label="Used">{formatBytes(diskUsed(host))}</Fact>
            <Fact label="Free">{formatBytes(host.disk.freeBytes)}</Fact>
          </>
        ) : (
          <Fact label="Disk">no reading</Fact>
        )}
        <Fact label="Docker build cache">{formatBytes(summary.agent?.buildCacheBytes ?? null)}</Fact>
        <Fact label="Uptime">{formatUptime(host.uptimeSeconds)}</Fact>
      </Card>
    </div>
  );
}
