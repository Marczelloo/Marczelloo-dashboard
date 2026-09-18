import Link from "next/link";
import { Columns3, ListChecks } from "lucide-react";
import { NewTaskButton } from "@/components/features/new-task-button";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Tone } from "@/lib/tone";
import type { WorkItem } from "@/types";

const TONE: Record<WorkItem["status"], Tone> = { open: "idle", in_progress: "live", blocked: "warn", done: "ok" };
const GROUPS: Array<{ status: WorkItem["status"]; label: string }> = [
  { status: "in_progress", label: "In progress" },
  { status: "blocked", label: "Blocked" },
  { status: "open", label: "Open" },
  { status: "done", label: "Done" },
];

export function TasksTab({ projectId, items }: { projectId: string; items: WorkItem[] }) {
  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Track bugs, changes and todos for this project here; they also appear in the global Tasks view."
          action={<NewTaskButton projectId={projectId} variant="secondary" />}
        />
      </Panel>
    );
  }

  // A lone group gets the full width; the rule across the app is that one column of content never sits in half a page.
  const groups = GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.status === group.status) })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" asChild>
          <Link href={`/projects/${projectId}/work-items`}>
            <Columns3 strokeWidth={1.75} />
            Open board
          </Link>
        </Button>
        <NewTaskButton projectId={projectId} />
      </div>
      <div className={cn("grid gap-4", groups.length > 1 && "md:grid-cols-2")}>
        {groups.map(({ status, label, items: group }) => {
          return (
            <Panel key={status}>
              <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
                <h2 className="text-[13.5px] font-semibold">{label}</h2>
                <span className="font-mono text-[11px] text-fg-3">{group.length}</span>
              </div>
              {group.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
                  <StatusDot status={TONE[item.status]} />
                  <Link href={`/projects/${projectId}/work-items/${item.id}`} className="min-w-0 truncate hover:underline">
                    {item.title}
                  </Link>
                  <span className="ml-auto flex items-center gap-2 text-[11.5px] text-fg-3">
                    {formatRelativeTime(item.updated_at)}
                    <Chip tone={item.priority === "critical" ? "err" : item.priority === "high" ? "warn" : "neutral"}>{item.priority}</Chip>
                  </span>
                </div>
              ))}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
