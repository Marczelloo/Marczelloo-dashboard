import { Panel } from "@/components/ui/card";
import { UptimeStrip } from "@/components/ui/uptime-strip";
import { formatRelativeTime } from "@/lib/utils";
import type { ProjectDetail } from "@/server/projects/detail";

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

function Segment({ label, children, detail }: { label: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <div className="mt-1.5">{children}</div>
      {detail && <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>}
    </div>
  );
}

const value = "text-[18px] font-semibold leading-tight tabular-nums";

export function ProjectStatusStrip({ detail }: { detail: ProjectDetail }) {
  const { agent, attention, uptime, deploys7d, workItems, tone } = detail;
  const containers = agent ? { running: agent.containers.filter((container) => container.status === "running").length, total: agent.containers.length } : null;
  const open = workItems.filter((item) => item.status !== "done");
  const topPriority = PRIORITY_ORDER.find((priority) => open.some((item) => item.priority === priority));
  const good = uptime.filter((bucket) => bucket.state === "ok").length;
  const measured = uptime.filter((bucket) => bucket.state !== "none").length;

  const status =
    attention?.kind === "deploying"
      ? { text: "Deploying", className: "text-accent-text" }
      : attention?.kind === "down"
        ? { text: "Down", className: "text-err" }
        : attention?.kind === "degraded"
          ? { text: "Degraded", className: "text-warn" }
          : tone === "idle"
            ? { text: "Not monitored", className: "text-fg-3" }
            : { text: "Healthy", className: "text-ok" };

  return (
    <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
      <Segment label="Status" detail={containers ? `${containers.running} / ${containers.total} containers up` : attention && attention.kind !== "deploying" ? attention.reason : "no containers reported"}>
        <p className={`${value} ${status.className}`}>{status.text}</p>
      </Segment>
      <Segment label="Uptime · 24 h" detail={measured ? `${Math.round((good / measured) * 100)}% of the last ${measured} h` : "no monitor data"}>
        <UptimeStrip buckets={uptime} className="h-3.5" />
      </Segment>
      <Segment label="Deploys · 7 days" detail={deploys7d.failed ? `${deploys7d.failed} failed` : detail.deploys[0] ? `last ${formatRelativeTime(detail.deploys[0].started_at)}` : "none yet"}>
        <p className={value}>{deploys7d.total}</p>
      </Segment>
      <Segment label="Open tasks" detail={topPriority ? `highest: ${topPriority}` : "nothing open"}>
        <p className={value}>{open.length}</p>
      </Segment>
    </Panel>
  );
}
