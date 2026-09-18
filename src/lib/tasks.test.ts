import { describe, expect, it } from "vitest";
import { parseTaskKey, sortTasks, toTaskRows, type TaskRow } from "./tasks";
import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { WorkItem } from "@/types";

const todo = (overrides: Partial<GeneralTodo> = {}): GeneralTodo => ({
  id: "t1",
  title: "Rotate the keys",
  description: null,
  priority: "medium",
  status: "pending",
  due_date: null,
  completed_at: null,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  ...overrides,
});

const item = (overrides: Partial<WorkItem> = {}): WorkItem =>
  ({
    id: "w1",
    project_id: "p1",
    type: "bug",
    title: "Deploy badge stuck",
    description: null,
    status: "blocked",
    priority: "high",
    labels: [],
    created_at: "2026-09-02T10:00:00Z",
    updated_at: "2026-09-02T10:00:00Z",
    ...overrides,
  }) as WorkItem;

const row = (overrides: Partial<TaskRow>): TaskRow => ({
  id: "todo:x",
  source: "todo",
  kind: "todo",
  projectId: null,
  projectName: null,
  title: "x",
  description: null,
  status: "open",
  priority: "medium",
  dueDate: null,
  updatedAt: "2026-09-01T10:00:00Z",
  ...overrides,
});

describe("toTaskRows", () => {
  it("gives both stores one shape and keeps the project name", () => {
    const rows = toTaskRows([todo()], [item()], new Map([["p1", "Dashboard"]]));
    expect(rows.map((task) => task.id)).toEqual(["work_item:w1", "todo:t1"]);
    expect(rows[0].projectName).toBe("Dashboard");
    expect(rows[1].projectId).toBeNull();
  });

  it("maps a completed todo onto the done status", () => {
    const [task] = toTaskRows([todo({ status: "completed" })], [], new Map());
    expect(task.status).toBe("done");
  });
});

describe("sortTasks", () => {
  it("puts blocked work first and done last", () => {
    const sorted = sortTasks([row({ id: "a", status: "done" }), row({ id: "b", status: "open" }), row({ id: "c", status: "blocked" })]);
    expect(sorted.map((task) => task.id)).toEqual(["c", "b", "a"]);
  });

  it("orders same-status work by due date, dated before undated", () => {
    const sorted = sortTasks([row({ id: "a" }), row({ id: "b", dueDate: "2026-09-20" }), row({ id: "c", dueDate: "2026-09-10" })]);
    expect(sorted.map((task) => task.id)).toEqual(["c", "b", "a"]);
  });
});

describe("parseTaskKey", () => {
  it("reads back the store and the id", () => {
    expect(parseTaskKey("work_item:abc")).toEqual({ source: "work_item", id: "abc" });
    expect(parseTaskKey("todo:abc")).toEqual({ source: "todo", id: "abc" });
  });
});
