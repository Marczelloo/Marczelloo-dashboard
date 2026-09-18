"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createTodoAction, updateTodoAction } from "@/app/actions/todos";
import { createWorkItemAction, updateWorkItemAction } from "@/app/actions/work-items";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui";
import { parseTaskKey, type TaskPriority, type TaskRow, type TaskStatus } from "@/lib/tasks";

export const NO_PROJECT = "none";

export interface TaskDraft {
  /** null while creating; otherwise the row id of the task being edited. */
  key: string | null;
  source: TaskRow["source"];
  projectId: string;
  kind: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
}

export const newTaskDraft = (projectId: string = NO_PROJECT): TaskDraft => ({
  key: null,
  source: projectId === NO_PROJECT ? "todo" : "work_item",
  projectId,
  kind: "todo",
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  dueDate: "",
});

export const draftOf = (task: TaskRow): TaskDraft => ({
  key: task.id,
  source: task.source,
  projectId: task.projectId ?? NO_PROJECT,
  kind: task.kind,
  title: task.title,
  description: task.description ?? "",
  priority: task.priority,
  status: task.status,
  dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
});

interface TaskDialogProps {
  initial: TaskDraft;
  /** Projects to choose from; omitted when the task belongs to a fixed project. */
  projects?: Array<{ id: string; name: string }>;
  onClose(): void;
  onSaved(): void;
}

/**
 * Create or edit a task without leaving the page, in whichever store it belongs to:
 * a general todo when no project is picked, a project work item otherwise.
 */
export function TaskDialog({ initial, projects, onClose, onSaved }: TaskDialogProps) {
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [saving, setSaving] = useState(false);
  const editing = draft.key !== null;
  const choosable = projects !== undefined && !editing;

  async function save() {
    if (!draft.title.trim()) {
      toast.error("A task needs a title");
      return;
    }
    setSaving(true);
    try {
      const result = await submit(draft);
      if (!result.success) {
        toast.error(result.error ?? "Could not save the task");
        return;
      }
      toast.success(editing ? "Task saved" : "Task created");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes are saved to the list this task lives on."
              : choosable
                ? "Pick a project to put it on that board, or leave it general."
                : "It lands in the Open column of this project's board."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5">
          <Field label="Title" htmlFor="task-title">
            <Input id="task-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What needs to be done?" autoFocus />
          </Field>
          <Field label="Description" htmlFor="task-description">
            <Textarea id="task-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} placeholder="Context, steps to reproduce, links." />
          </Field>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {choosable && (
              <Field label="Project" htmlFor="task-project">
                <Select value={draft.projectId} onValueChange={(value) => setDraft({ ...draft, projectId: value, source: value === NO_PROJECT ? "todo" : "work_item" })}>
                  <SelectTrigger id="task-project">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>No project</SelectItem>
                    {projects.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {draft.source === "work_item" && !editing && (
              <Field label="Type" htmlFor="task-kind">
                <Select value={draft.kind} onValueChange={(value) => setDraft({ ...draft, kind: value })}>
                  <SelectTrigger id="task-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Todo</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="change">Change</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Priority" htmlFor="task-priority">
              <Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value as TaskPriority })}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {editing && (
              <Field label="Status" htmlFor="task-status">
                <Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as TaskStatus })}>
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    {draft.source === "work_item" && <SelectItem value="blocked">Blocked</SelectItem>}
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {draft.source === "todo" && (
              <Field label="Due date" htmlFor="task-due" note="General tasks only">
                <Input id="task-due" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
              </Field>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            {editing ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The note sits with the label so a field with one stays the same height as the field beside it. */
function Field({ label, htmlFor, note, children }: { label: string; htmlFor: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-xs font-medium text-fg-2">
        {label}
        {note && <span className="text-[11px] font-normal text-fg-4">{note}</span>}
      </label>
      {children}
    </div>
  );
}

async function submit(draft: TaskDraft): Promise<{ success: boolean; error?: string }> {
  const description = draft.description.trim() || undefined;

  if (draft.key) {
    const { id } = parseTaskKey(draft.key);
    if (draft.source === "todo") {
      return updateTodoAction(id, {
        title: draft.title,
        description,
        priority: draft.priority,
        status: draft.status === "done" ? "completed" : draft.status === "in_progress" ? "in_progress" : "pending",
        due_date: draft.dueDate || null,
      });
    }
    return updateWorkItemAction(id, { title: draft.title, description, priority: draft.priority, status: draft.status });
  }

  if (draft.source === "todo") {
    return createTodoAction({ title: draft.title, description, priority: draft.priority, due_date: draft.dueDate || undefined });
  }
  return createWorkItemAction({
    project_id: draft.projectId,
    type: draft.kind as "todo" | "bug" | "change",
    title: draft.title,
    description,
    priority: draft.priority,
  });
}
