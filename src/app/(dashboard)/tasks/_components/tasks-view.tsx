"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTodoAction, deleteTodoAction, updateTodoAction } from "@/app/actions/todos";
import { createWorkItemAction, deleteWorkItemAction, updateWorkItemAction } from "@/app/actions/work-items";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Panel,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Tone } from "@/lib/tone";
import { parseTaskKey, type TaskList, type TaskPriority, type TaskRow, type TaskStatus } from "@/lib/tasks";

const STATUS_TONE: Record<TaskStatus, Tone> = { open: "idle", in_progress: "live", blocked: "warn", done: "ok" };
const PRIORITY_TONE: Record<TaskPriority, "idle" | "neutral" | "warn" | "err"> = { low: "idle", medium: "neutral", high: "warn", critical: "err" };
const STATUS_LABEL: Record<TaskStatus, string> = { open: "Open", in_progress: "In progress", blocked: "Blocked", done: "Done" };
const NO_PROJECT = "none";
const DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

type Filter = "all" | TaskStatus;

const isOverdue = (task: TaskRow) => Boolean(task.dueDate) && task.status !== "done" && task.dueDate!.slice(0, 10) < new Date().toISOString().slice(0, 10);

interface Draft {
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

const emptyDraft = (): Draft => ({
  key: null,
  source: "todo",
  projectId: NO_PROJECT,
  kind: "todo",
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  dueDate: "",
});

/** One list over general todos and project work items; the store a row belongs to only shows in its project chip. */
export function TasksView({ data }: { data: TaskList }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [project, setProject] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const counts = useMemo(
    () => ({
      all: data.tasks.length,
      open: data.tasks.filter((task) => task.status === "open").length,
      in_progress: data.tasks.filter((task) => task.status === "in_progress").length,
      blocked: data.tasks.filter((task) => task.status === "blocked").length,
      done: data.tasks.filter((task) => task.status === "done").length,
      overdue: data.tasks.filter(isOverdue).length,
    }),
    [data.tasks]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.tasks.filter((task) => {
      if (filter !== "all" && task.status !== filter) return false;
      if (project === NO_PROJECT && task.projectId) return false;
      if (project !== "all" && project !== NO_PROJECT && task.projectId !== project) return false;
      if (needle && !`${task.title} ${task.description ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data.tasks, filter, project, query]);

  const refresh = () => startTransition(() => router.refresh());

  async function toggle(task: TaskRow) {
    const { id } = parseTaskKey(task.id);
    const done = task.status === "done";
    const result =
      task.source === "todo"
        ? await updateTodoAction(id, { status: done ? "pending" : "completed" })
        : await updateWorkItemAction(id, { status: done ? "open" : "done" });
    if (!result.success) {
      toast.error(result.error ?? "Could not change the task");
      return;
    }
    refresh();
  }

  async function remove(task: TaskRow) {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    const { id } = parseTaskKey(task.id);
    const result = task.source === "todo" ? await deleteTodoAction(id) : await deleteWorkItemAction(id);
    if (!result.success) {
      toast.error(result.error ?? "Could not delete the task");
      return;
    }
    toast.success("Task deleted");
    refresh();
  }

  function edit(task: TaskRow) {
    setDraft({
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
  }

  async function save() {
    if (!draft) return;
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
      toast.success(draft.key ? "Task saved" : "Task created");
      setDraft(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything on the list, from loose todos to work on a project"
        actions={
          <Button onClick={() => setDraft(emptyDraft())}>
            <Plus strokeWidth={1.75} />
            New task
          </Button>
        }
      />

      <PageBody className="flex flex-col gap-4">
        <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
          <Summary label="Open" value={counts.open} detail="Not started" />
          <Summary label="In progress" value={counts.in_progress} detail="Being worked on" tone="live" />
          <Summary label="Blocked" value={counts.blocked} detail={counts.blocked ? "Waiting on something" : "Nothing stuck"} tone={counts.blocked ? "warn" : undefined} />
          <Summary label="Overdue" value={counts.overdue} detail={counts.overdue ? "Past the due date" : "Nothing late"} tone={counts.overdue ? "err" : undefined} />
        </Panel>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Filter>
            aria-label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "open", label: "Open", count: counts.open },
              { value: "in_progress", label: "In progress", count: counts.in_progress },
              { value: "blocked", label: "Blocked", count: counts.blocked },
              { value: "done", label: "Done", count: counts.done },
            ]}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" className="h-8 w-[180px]" aria-label="Search tasks" />
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="h-8 w-[190px]" aria-label="Filter by project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {data.projects.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Panel className={cn("transition-opacity duration-base", pending && "opacity-60")}>
          {visible.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={data.tasks.length ? "Nothing matches" : "No tasks yet"}
              description={data.tasks.length ? "Loosen the filters to see the rest of the list." : "Track anything here; tasks on a project also show on its board."}
              action={
                data.tasks.length ? undefined : (
                  <Button size="sm" onClick={() => setDraft(emptyDraft())}>
                    <Plus strokeWidth={1.75} />
                    New task
                  </Button>
                )
              }
            />
          ) : (
            visible.map((task) => (
              <div key={task.id} className="flex items-start gap-3 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
                <button
                  type="button"
                  onClick={() => void toggle(task)}
                  aria-label={task.status === "done" ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  className={cn(
                    "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-quick ease-out",
                    task.status === "done" ? "border-ok/60 bg-ok/15 text-ok" : "border-line-strong text-transparent hover:border-fg-3 hover:text-fg-4"
                  )}
                >
                  <Check className="size-3" strokeWidth={2.5} />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={cn("text-[13px] font-medium", task.status === "done" ? "text-fg-3 line-through" : "text-fg")}>{task.title}</span>
                    {task.status !== "open" && task.status !== "done" && (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
                        <StatusDot status={STATUS_TONE[task.status]} />
                        {STATUS_LABEL[task.status]}
                      </span>
                    )}
                  </p>
                  {task.description && <p className="mt-0.5 line-clamp-1 text-[12px] text-fg-3">{task.description}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {task.dueDate && (
                    <Chip tone={isOverdue(task) ? "err" : "neutral"}>
                      {isOverdue(task) ? "overdue " : ""}
                      {DATE.format(new Date(task.dueDate))}
                    </Chip>
                  )}
                  <Chip tone={PRIORITY_TONE[task.priority]}>{task.priority}</Chip>
                  {task.projectId ? (
                    <Link href={`/projects/${task.projectId}?tab=tasks`} className="hidden max-w-[140px] truncate text-right text-[11.5px] text-fg-3 hover:text-fg sm:block sm:w-[110px]">
                      {task.projectName ?? "project"}
                    </Link>
                  ) : (
                    <span className="hidden text-right text-[11.5px] text-fg-4 sm:block sm:w-[110px]">general</span>
                  )}
                  <span className="hidden w-[74px] text-right text-[11.5px] text-fg-4 lg:inline">{formatRelativeTime(task.updatedAt)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${task.title}`} onClick={() => edit(task)}>
                    <Pencil strokeWidth={1.75} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${task.title}`} onClick={() => void remove(task)}>
                    <Trash2 strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </Panel>
      </PageBody>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.key ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              {draft?.key ? "Changes are saved to the list this task lives on." : "Pick a project to put it on that board, or leave it general."}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="grid gap-3.5">
              <Field label="Title" htmlFor="task-title">
                <Input id="task-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What needs to be done?" autoFocus />
              </Field>
              <Field label="Description" htmlFor="task-description">
                <Textarea id="task-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} />
              </Field>

              {!draft.key && (
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Project" htmlFor="task-project">
                    <Select value={draft.projectId} onValueChange={(value) => setDraft({ ...draft, projectId: value, source: value === NO_PROJECT ? "todo" : "work_item" })}>
                      <SelectTrigger id="task-project">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PROJECT}>No project</SelectItem>
                        {data.projects.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {draft.source === "work_item" && (
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
                </div>
              )}

              <div className="grid gap-3.5 sm:grid-cols-2">
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
                {draft.key ? (
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
                ) : null}
                {draft.source === "todo" && (
                  <Field label="Due date" htmlFor="task-due" hint="Only general tasks carry a due date.">
                    <Input id="task-due" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
                  </Field>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              {draft?.key ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ label, value, detail, tone }: { label: string; value: number; detail: string; tone?: Tone }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <p className="mt-1.5 flex items-center gap-2 text-[18px] font-semibold leading-tight tabular-nums">
        {tone && value > 0 && <StatusDot status={tone} />}
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-fg-4">{detail}</p>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-fg-3">{hint}</p>}
    </div>
  );
}

/** Creates or updates in whichever store the task belongs to. */
async function submit(draft: Draft): Promise<{ success: boolean; error?: string }> {
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
