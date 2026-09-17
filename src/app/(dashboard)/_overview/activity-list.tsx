import Link from "next/link";
import { Activity } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusDot } from "@/components/status-dot";
import { formatRelativeTime } from "@/lib/utils";
import type { ActivityItem } from "@/server/overview/types";

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
        <h2 className="text-[13.5px] font-semibold">Activity</h2>
        <Link href="/audit-log" className="text-xs text-fg-3 hover:text-fg">Audit log</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Deploys, incidents and restarts show up here." />
      ) : (
        <ul className="divide-y divide-line-subtle px-3.5">
          {items.map((item) => {
            const body = (
              <>
                <StatusDot status={item.tone} className="mt-1.5" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-fg">{item.title}</span>
                  {item.detail && <span className="block truncate font-mono text-xs text-fg-3">{item.detail}</span>}
                </span>
                <time dateTime={item.at} className="mt-0.5 whitespace-nowrap font-mono text-[11.5px] text-fg-4">{formatRelativeTime(item.at)}</time>
              </>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="-mx-1.5 grid grid-cols-[16px_1fr_auto] items-start gap-2.5 rounded-sm px-1.5 py-2.5 transition-colors duration-quick hover:bg-white/[.03]">{body}</Link>
                ) : (
                  <div className="grid grid-cols-[16px_1fr_auto] items-start gap-2.5 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
