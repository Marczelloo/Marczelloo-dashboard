"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { deleteWorkItemAction, updateWorkItemAction } from "@/app/actions/work-items";
import { FormActions, FormField, FormLayout, FormSection } from "@/components/layout/form-layout";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, Input, Panel, SegmentedControl, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea } from "@/components/ui";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { Tone } from "@/lib/tone";
import type { WorkItem, WorkItemStatus } from "@/types";

interface WorkItemDetailPageProps {
  params: Promise<{ id: string; itemId: string }>;
}

type ItemType = "todo" | "bug" | "change";
type Priority = "low" | "medium" | "high" | "critical";

const STATUS_TONE: Record<WorkItemStatus, Tone> = { open: "idle", in_progress: "live", blocked: "warn", done: "ok" };
const PRIORITY_TONE: Record<Priority, "idle" | "neutral" | "warn" | "err"> = { low: "idle", medium: "neutral", high: "warn", critical: "err" };
const STATUS_OPTIONS: { value: WorkItemStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const toLabels = (value: string) =>
  value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

export default function WorkItemDetailPage({ params }: WorkItemDetailPageProps) {
  const { id: projectId, itemId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<WorkItem | null>(null);
  const [form, setForm] = useState({
    type: "todo" as ItemType,
    title: "",
    description: "",
    status: "open" as WorkItemStatus,
    priority: "medium" as Priority,
    labels: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/work-items/${itemId}`);
        const data = (await response.json().catch(() => ({}))) as { workItem?: WorkItem };
        if (data.workItem) {
          setItem(data.workItem);
          setForm({
            type: (data.workItem.type as ItemType) || "todo",
            title: data.workItem.title || "",
            description: data.workItem.description || "",
            status: data.workItem.status || "open",
            priority: (data.workItem.priority as Priority) || "medium",
            labels: Array.isArray(data.workItem.labels) ? data.workItem.labels.join(", ") : "",
          });
        }
      } catch {
        setError("Failed to load this task");
      }
      setIsLoading(false);
    }
    void load();
  }, [itemId]);

  async function changeStatus(status: WorkItemStatus) {
    const previous = form.status;
    setForm((current) => ({ ...current, status }));
    const result = await updateWorkItemAction(itemId, { status }).catch(() => ({ success: false, error: "Something went wrong" }));
    if (!result.success) {
      setForm((current) => ({ ...current, status: previous }));
      setError(result.error || "Failed to change the status");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateWorkItemAction(itemId, {
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        priority: form.priority,
        labels: toLabels(form.labels).length ? toLabels(form.labels) : undefined,
      });
      if (!result.success) {
        setError(result.error || "Failed to save this task");
        return;
      }
      router.push(`/projects/${projectId}/work-items`);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${form.title || "this task"}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteWorkItemAction(itemId);
      if (!result.success) {
        setError(result.error || "Failed to delete this task");
        return;
      }
      router.push(`/projects/${projectId}/work-items`);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Task" description="Loading…" />
        <PageBody className="grid gap-4">
          <Skeleton className="h-9 w-[320px] rounded-md" />
          <Skeleton className="h-[420px] rounded-lg" />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={form.title || "Task"}
        description={item ? `${form.type} · created ${formatRelativeTime(item.created_at)}` : undefined}
        actions={
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}/work-items`}>
              <ArrowLeft strokeWidth={1.75} />
              Back to board
            </Link>
          </Button>
        }
      >
        <SegmentedControl aria-label="Task status" value={form.status} onChange={(value) => void changeStatus(value)} options={STATUS_OPTIONS} />
      </PageHeader>

      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormLayout
            rail={
              <Panel className="grid gap-2.5 p-3.5">
                <p className="text-[11.5px] text-fg-3">Preview on the board</p>
                <div className="rounded-md border border-line bg-canvas p-2.5">
                  <p className="flex items-start gap-2">
                    <StatusDot status={STATUS_TONE[form.status]} className="mt-1.5" />
                    <span className="line-clamp-2 text-[13px] font-medium text-fg">{form.title || "Untitled task"}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-[18px]">
                    <Chip tone={PRIORITY_TONE[form.priority]}>{form.priority}</Chip>
                    <Chip mono>{form.type}</Chip>
                  </div>
                </div>
                {item && (
                  <>
                    <p className="text-[11.5px] text-fg-3">Timeline</p>
                    <p className="text-[12px] text-fg-3">Created {formatDateTime(item.created_at)}</p>
                    <p className="text-[12px] text-fg-3">Updated {formatRelativeTime(item.updated_at)}</p>
                  </>
                )}
              </Panel>
            }
          >
            {error && <p className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">{error}</p>}

            <FormSection title="Task" description="What has to happen, and why.">
              <FormField label="Title" htmlFor="title">
                <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
              </FormField>
              <FormField label="Description" htmlFor="description">
                <Textarea id="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={6} />
              </FormField>
            </FormSection>

            <FormSection title="Classification" description="How this task is sorted on the board.">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField label="Type" htmlFor="type">
                  <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as ItemType })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">Todo</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="change">Change</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Priority" htmlFor="priority">
                  <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as Priority })}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Labels" htmlFor="labels" hint="Comma separated.">
                <Input id="labels" value={form.labels} onChange={(event) => setForm({ ...form, labels: event.target.value })} placeholder="frontend, ui, performance" />
              </FormField>
            </FormSection>

            <FormActions note="The status above is saved as soon as you pick it.">
              <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isSaving || isDeleting}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving} disabled={isDeleting}>
                <Save strokeWidth={1.75} />
                Save changes
              </Button>
            </FormActions>

            <FormSection title="Danger zone" description="This permanently removes the task." tone="danger">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] text-fg-3">Nothing else references it; the board simply loses the card.</p>
                <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete} disabled={isSaving}>
                  <Trash2 strokeWidth={1.75} />
                  Delete task
                </Button>
              </div>
            </FormSection>
          </FormLayout>
        </form>
      </PageBody>
    </>
  );
}
