import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { formatShortDate } from "@/lib/utils";
import type { Task } from "@/server/overview/types";

const PRIORITY_TONE = { low: "idle", medium: "neutral", high: "warn", critical: "err" } as const;

export function TasksDue({ tasks, now }: { tasks: Task[]; now: string }) {
  const today = now.slice(0, 10);
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
        <h2 className="text-[13.5px] font-semibold">Tasks due</h2>
        <Link href="/tasks" className="text-xs text-fg-3 hover:text-fg">All tasks</Link>
      </div>
      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing due" description="Overdue, soon-due and blocked tasks from every project land here." />
      ) : (
        <ul className="divide-y divide-line-subtle px-3.5">
          {tasks.map((task) => {
            const overdue = task.dueDate !== null && task.dueDate.slice(0, 10) < today;
            return (
              <li key={task.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-fg">{task.title}</span>
                  <span className={overdue ? "text-xs text-err" : "text-xs text-fg-3"}>
                    {task.status === "blocked" ? "Blocked" : task.dueDate ? `${overdue ? "Overdue · " : "Due "}${formatShortDate(task.dueDate)}` : "No due date"}
                  </span>
                </span>
                <Chip tone={PRIORITY_TONE[task.priority]}>{task.priority}</Chip>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
