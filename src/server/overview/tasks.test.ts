import { describe, expect, it } from "vitest";
import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { WorkItem } from "@/types";
import { tasksDue, toTasks } from "./tasks";

const todo = (partial: Partial<GeneralTodo>): GeneralTodo => ({
  id: "t",
  title: "Todo",
  description: null,
  priority: "medium",
  status: "pending",
  due_date: null,
  completed_at: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  ...partial,
});

const item = (partial: Partial<WorkItem>): WorkItem => ({
  id: "w",
  project_id: "p",
  type: "todo",
  title: "Item",
  description: null,
  status: "open",
  priority: "medium",
  labels: [],
  github_issue_number: null,
  github_pr_number: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-12T00:00:00.000Z",
  ...partial,
});

describe("toTasks", () => {
  it("maps both sources onto one shape", () => {
    const tasks = toTasks([todo({ id: "t1", status: "completed", due_date: "2026-09-20" })], [item({ id: "w1", status: "blocked" })]);
    expect(tasks).toEqual([
      { id: "todo:t1", source: "todo", projectId: null, title: "Todo", status: "done", priority: "medium", dueDate: "2026-09-20", updatedAt: "2026-09-10T00:00:00.000Z" },
      { id: "work_item:w1", source: "work_item", projectId: "p", title: "Item", status: "blocked", priority: "medium", dueDate: null, updatedAt: "2026-09-12T00:00:00.000Z" },
    ]);
  });
});

describe("tasksDue", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");

  it("lists overdue, then due within three days, then blocked; skips done and far-off tasks", () => {
    const tasks = toTasks(
      [
        todo({ id: "soon", due_date: "2026-09-19" }),
        todo({ id: "late", due_date: "2026-09-15" }),
        todo({ id: "later", due_date: "2026-10-30" }),
        todo({ id: "done", due_date: "2026-09-10", status: "completed" }),
        todo({ id: "undated" }),
      ],
      [item({ id: "blocked", status: "blocked" })]
    );
    expect(tasksDue(tasks, now).map((task) => task.id)).toEqual(["todo:late", "todo:soon", "work_item:blocked"]);
  });

  it("respects the limit", () => {
    const tasks = toTasks([todo({ id: "a", due_date: "2026-09-16" }), todo({ id: "b", due_date: "2026-09-17" })], []);
    expect(tasksDue(tasks, now, 1)).toHaveLength(1);
  });
});
