/**
 * General Todos Repository - CRUD for general todo items (not project-specific)
 */

import "server-only";
import * as db from "./client";

const TABLE = "general_todos";

export type TodoPriority = "low" | "medium" | "high" | "critical";
export type TodoStatus = "pending" | "in_progress" | "completed";

export interface GeneralTodo {
  id: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: TodoPriority;
  due_date?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
  due_date?: string | null;
  completed_at?: string | null;
}

export async function getTodos(status?: TodoStatus): Promise<GeneralTodo[]> {
  const filters: db.QueryFilter[] = [];

  if (status) {
    filters.push({ operator: "eq", column: "status", value: status });
  }

  const response = await db.select<GeneralTodo>(TABLE, {
    filters: filters.length > 0 ? filters : undefined,
    order: { column: "created_at", direction: "desc" },
  });
  return response.data;
}

export async function getActiveTodos(): Promise<GeneralTodo[]> {
  const response = await db.select<GeneralTodo>(TABLE, {
    filters: [{ operator: "in", column: "status", value: ["pending", "in_progress"] }],
    order: { column: "priority", direction: "desc" },
  });
  return response.data;
}

export async function getTodoById(id: string): Promise<GeneralTodo | null> {
  return db.selectById<GeneralTodo>(TABLE, id);
}

export async function createTodo(input: CreateTodoInput): Promise<GeneralTodo> {
  const data = {
    title: input.title,
    description: input.description || null,
    priority: input.priority || "medium",
    status: "pending" as TodoStatus,
    due_date: input.due_date || null,
  };

  const response = await db.insert<GeneralTodo>(TABLE, data);
  return response.data[0];
}

export async function updateTodo(id: string, input: UpdateTodoInput): Promise<GeneralTodo | null> {
  const updates: Partial<GeneralTodo> = { ...input };

  // If marking as completed, set completed_at
  if (input.status === "completed" && !input.completed_at) {
    updates.completed_at = new Date().toISOString();
  }
  // If un-completing, clear completed_at
  if (input.status && input.status !== "completed") {
    updates.completed_at = null;
  }

  return db.updateById<GeneralTodo>(TABLE, id, updates);
}

export async function deleteTodo(id: string): Promise<boolean> {
  const result = await db.deleteById(TABLE, id);
  return result.deletedCount > 0;
}

export async function toggleTodoStatus(id: string): Promise<GeneralTodo | null> {
  const todo = await getTodoById(id);
  if (!todo) {
    throw new Error("Todo not found");
  }

  const newStatus: TodoStatus = todo.status === "completed" ? "pending" : "completed";
  return updateTodo(id, { status: newStatus });
}

export async function getTodosByDueDate(before: string): Promise<GeneralTodo[]> {
  const response = await db.select<GeneralTodo>(TABLE, {
    filters: [
      { operator: "lte", column: "due_date", value: before },
      { operator: "neq", column: "status", value: "completed" },
    ],
    order: { column: "due_date", direction: "asc" },
  });
  return response.data;
}
