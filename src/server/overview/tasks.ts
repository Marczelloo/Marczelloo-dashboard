import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { WorkItem } from "@/types";
import type { Task } from "./types";

const TODO_STATUS: Record<GeneralTodo["status"], Task["status"]> = { pending: "open", in_progress: "in_progress", completed: "done" };
const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_DAYS = 3;

export function toTasks(todos: GeneralTodo[], workItems: WorkItem[]): Task[] {
  return [
    ...todos.map((todo): Task => ({ id: `todo:${todo.id}`, source: "todo", projectId: null, title: todo.title, status: TODO_STATUS[todo.status], priority: todo.priority, dueDate: todo.due_date, updatedAt: todo.updated_at })),
    ...workItems.map((item): Task => ({ id: `work_item:${item.id}`, source: "work_item", projectId: item.project_id, title: item.title, status: item.status, priority: item.priority, dueDate: null, updatedAt: item.updated_at })),
  ];
}

/** Overdue first (earliest due), then due within three days, then blocked (most recently touched). */
export function tasksDue(tasks: Task[], now: Date, limit = 5): Task[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const bucket = (task: Task): number | null => {
    if (task.status === "done") return null;
    if (task.dueDate) {
      const due = Date.parse(task.dueDate.slice(0, 10));
      if (due < today) return 0;
      if (due <= today + SOON_DAYS * DAY_MS) return 1;
    }
    return task.status === "blocked" ? 2 : null;
  };
  return tasks
    .map((task) => ({ task, rank: bucket(task) }))
    .filter((entry): entry is { task: Task; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? "") || b.task.updatedAt.localeCompare(a.task.updatedAt))
    .slice(0, limit)
    .map((entry) => entry.task);
}
