"use server";

import { revalidatePath } from "next/cache";
import { generalTodos } from "@/server/atlashub";
import type { TodoPriority, TodoStatus } from "@/server/atlashub/general-todos";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function getTodosAction(status?: TodoStatus) {
  try {
    const todos = await generalTodos.getTodos(status);
    return { success: true, data: todos };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch todos" };
  }
}

export async function getActiveTodosAction() {
  try {
    const todos = await generalTodos.getActiveTodos();
    return { success: true, data: todos };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch todos" };
  }
}

export async function createTodoAction(input: {
  title: string;
  description?: string;
  priority?: TodoPriority;
  due_date?: string;
}): Promise<ActionResult> {
  try {
    await generalTodos.createTodo(input);
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create todo" };
  }
}

export async function updateTodoAction(
  id: string,
  input: {
    title?: string;
    description?: string;
    priority?: TodoPriority;
    status?: TodoStatus;
    due_date?: string | null;
  }
): Promise<ActionResult> {
  try {
    await generalTodos.updateTodo(id, input);
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update todo" };
  }
}

export async function toggleTodoAction(id: string): Promise<ActionResult> {
  try {
    await generalTodos.toggleTodoStatus(id);
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to toggle todo" };
  }
}

export async function deleteTodoAction(id: string): Promise<ActionResult> {
  try {
    await generalTodos.deleteTodo(id);
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete todo" };
  }
}
