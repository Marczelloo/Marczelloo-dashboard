import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { WorkItem } from "@/types";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

/** A general todo and a project work item, told apart only by `source`. */
export interface TaskRow {
  id: string;
  source: "todo" | "work_item";
  kind: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  updatedAt: string;
}

export interface TaskList {
  tasks: TaskRow[];
  projects: Array<{ id: string; name: string }>;
}

const TODO_STATUS: Record<GeneralTodo["status"], TaskStatus> = { pending: "open", in_progress: "in_progress", completed: "done" };

export const taskKey = (source: TaskRow["source"], id: string) => `${source}:${id}`;

/** Splits a row id back into the store it came from. */
export function parseTaskKey(key: string): { source: TaskRow["source"]; id: string } {
  const [source, ...rest] = key.split(":");
  return { source: source === "todo" ? "todo" : "work_item", id: rest.join(":") };
}

const RANK: Record<TaskStatus, number> = { blocked: 0, in_progress: 1, open: 2, done: 3 };

/** Blocked and in-flight work first, then anything with a due date, then the most recently touched. */
export function sortTasks(tasks: TaskRow[]): TaskRow[] {
  return [...tasks].sort((a, b) => {
    if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function toTaskRows(todos: GeneralTodo[], items: WorkItem[], names: Map<string, string>): TaskRow[] {
  return sortTasks([
    ...todos.map(
      (todo): TaskRow => ({
        id: taskKey("todo", todo.id),
        source: "todo",
        kind: "todo",
        projectId: null,
        projectName: null,
        title: todo.title,
        description: todo.description,
        status: TODO_STATUS[todo.status],
        priority: todo.priority,
        dueDate: todo.due_date,
        updatedAt: todo.updated_at,
      })
    ),
    ...items.map(
      (item): TaskRow => ({
        id: taskKey("work_item", item.id),
        source: "work_item",
        kind: item.type,
        projectId: item.project_id,
        projectName: names.get(item.project_id) ?? null,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        dueDate: null,
        updatedAt: item.updated_at,
      })
    ),
  ]);
}
