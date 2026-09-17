import { Meter } from "@/components/ui/meter";
import { Panel } from "@/components/ui/card";
import { StatusDot } from "@/components/status-dot";
import { formatRelativeTime } from "@/lib/utils";
import type { Overview } from "@/server/overview/types";

function Segment({ label, children, detail, dot }: { label: string; children: React.ReactNode; detail?: string; dot?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="flex items-center gap-2 text-[11.5px] text-fg-3">
        {dot}
        {label}
      </p>
      <div className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{children}</div>
      {detail && <p className="mt-0.5 truncate text-[11.5px] text-fg-3">{detail}</p>}
    </div>
  );
}

export function StatusBar({ overview }: { overview: Overview }) {
  const { domains, incidents, deploys7d, host } = overview;
  const allUp = domains.total > 0 && domains.up === domains.total;
  return (
    <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-[1.1fr_1fr_1fr_1.6fr] md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
      <Segment
        label="Domains"
        dot={<StatusDot status={domains.total === 0 ? "idle" : allUp ? "ok" : "err"} size="sm" />}
        detail={domains.checkedAt ? `checked ${formatRelativeTime(domains.checkedAt)}` : "not checked yet"}
      >
        {domains.up}
        <span className="text-[13px] font-medium tracking-normal text-fg-4"> / {domains.total} up</span>
      </Segment>
      <Segment label="Incidents" detail={incidents.newest ? `${incidents.newest.label} · ${formatRelativeTime(incidents.newest.since)}` : "none open"}>
        <span className={incidents.open > 0 ? "text-err" : undefined}>{incidents.open}</span>
      </Segment>
      <Segment label="Deploys · 7 days" detail={deploys7d.failed ? `${deploys7d.failed} failed` : "no failures"}>
        {deploys7d.total}
      </Segment>
      <div className="col-span-2 min-w-0 px-[18px] py-3.5 md:col-span-1">
        <p className="truncate text-[11.5px] text-fg-3">Host{host ? ` · ${host.hostname}` : ""}</p>
        {host ? (
          <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meter label="CPU" value={host.cpu} />
            <Meter label="RAM" value={host.memory} />
            <Meter label="Disk" value={host.disk} tone={host.disk >= 85 ? "warn" : "neutral"} />
            {host.temperature !== null && <Meter label="Temp" value={Math.min(100, (host.temperature / 85) * 100)} display={`${Math.round(host.temperature)}°`} tone={host.temperature >= 70 ? "warn" : "neutral"} />}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-fg-3">Agent unavailable</p>
        )}
      </div>
    </Panel>
  );
}
