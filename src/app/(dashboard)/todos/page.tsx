"use client";

import { useState, useEffect, useCallback } from "react";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { Card, CardContent, Button, Input, Textarea, Badge, Skeleton } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, Trash2, Edit2, Loader2, Calendar, Flag, RefreshCw, ListChecks } from "lucide-react";
import { toast } from "sonner";
import {
  getTodosAction,
  createTodoAction,
  updateTodoAction,
  toggleTodoAction,
  deleteTodoAction,
} from "@/app/actions/todos";
import type { GeneralTodo, TodoPriority } from "@/server/atlashub/general-todos";
import { cn } from "@/lib/utils";

const priorityColors: Record<TodoPriority, string> = {
  low: "text-muted-foreground",
  medium: "text-blue-500",
  high: "text-yellow-500",
  critical: "text-red-500",
};

const priorityBadgeVariants: Record<TodoPriority, "secondary" | "default" | "warning" | "danger"> = {
  low: "secondary",
  medium: "default",
  high: "warning",
  critical: "danger",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export default function TodosPage() {
  const [todos, setTodos] = useState<GeneralTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  // Add/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<GeneralTodo | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTodosAction(filter === "completed" ? "completed" : undefined);
      if (result.success && result.data) {
        let filtered = result.data;
        if (filter === "active") {
          filtered = result.data.filter((t) => t.status !== "completed");
        }
        setTodos(filtered);
      }
    } catch {
      toast.error("Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  function openAddDialog() {
    setEditingTodo(null);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setDialogOpen(true);
  }

  function openEditDialog(todo: GeneralTodo) {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description || "");
    setPriority(todo.priority);
    setDueDate(todo.due_date ? todo.due_date.split("T")[0] : "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      if (editingTodo) {
        const result = await updateTodoAction(editingTodo.id, {
          title,
          description: description || undefined,
          priority,
          due_date: dueDate || null,
        });
        if (result.success) {
          toast.success("Todo updated");
          setDialogOpen(false);
          fetchTodos();
        } else {
          toast.error(result.error || "Failed to update");
        }
      } else {
        const result = await createTodoAction({
          title,
          description: description || undefined,
          priority,
          due_date: dueDate || undefined,
        });
        if (result.success) {
          toast.success("Todo created");
          setDialogOpen(false);
          fetchTodos();
        } else {
          toast.error(result.error || "Failed to create");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string) {
    const result = await toggleTodoAction(id);
    if (result.success) {
      fetchTodos();
    } else {
      toast.error(result.error || "Failed to toggle");
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteTodoAction(id);
    if (result.success) {
      toast.success("Todo deleted");
      fetchTodos();
    } else {
      toast.error(result.error || "Failed to delete");
    }
  }

  const activeTodos = todos.filter((t) => t.status !== "completed");
  const completedTodos = todos.filter((t) => t.status === "completed");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ListChecks className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Todos</h1>
              <p className="text-sm text-muted-foreground">General task list</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageInfoButton {...PAGE_INFO.todos} />
            <Button variant="outline" size="sm" onClick={fetchTodos}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Add Todo
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(["all", "active", "completed"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "active" && activeTodos.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeTodos.length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : todos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Check className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {filter === "completed" ? "No completed todos" : "No todos yet. Add one to get started!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => (
              <Card key={todo.id} className={cn("transition-opacity", todo.status === "completed" && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggle(todo.id)}
                      className={cn(
                        "mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        todo.status === "completed"
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground hover:border-primary"
                      )}
                    >
                      {todo.status === "completed" && <Check className="h-3 w-3" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "font-medium",
                            todo.status === "completed" && "line-through text-muted-foreground"
                          )}
                        >
                          {todo.title}
                        </span>
                        <Badge variant={priorityBadgeVariants[todo.priority]} className="text-xs">
                          <Flag className={cn("h-3 w-3 mr-1", priorityColors[todo.priority])} />
                          {todo.priority}
                        </Badge>
                        {todo.due_date && (
                          <Badge
                            variant={isOverdue(todo.due_date) && todo.status !== "completed" ? "danger" : "secondary"}
                            className="text-xs"
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(todo.due_date)}
                          </Badge>
                        )}
                      </div>
                      {todo.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(todo)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(todo.id)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && todos.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{activeTodos.length} active</span>
                <span>{completedTodos.length} completed</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTodo ? "Edit Todo" : "Add Todo"}</DialogTitle>
            <DialogDescription>
              {editingTodo ? "Update your task details." : "Create a new task to track."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TodoPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date (optional)</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTodo ? "Save Changes" : "Create Todo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
