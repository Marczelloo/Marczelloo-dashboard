"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { createWorkItemAction } from "@/app/actions/work-items";
import { FormActions, FormField, FormLayout, FormSection } from "@/components/layout/form-layout";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, Input, Panel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/ui";

interface NewWorkItemPageProps {
  params: Promise<{ id: string }>;
}

type ItemType = "todo" | "bug" | "change";
type Priority = "low" | "medium" | "high" | "critical";

const TYPE_BLURB: Record<ItemType, string> = {
  todo: "Work you plan to do; the default for anything that is not broken.",
  bug: "Something behaves incorrectly and needs a fix.",
  change: "A deliberate change of behaviour, config or infrastructure.",
};

const PRIORITY_TONE: Record<Priority, "idle" | "neutral" | "warn" | "err"> = {
  low: "idle",
  medium: "neutral",
  high: "warn",
  critical: "err",
};

const toLabels = (value: string) =>
  value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

export default function NewWorkItemPage({ params }: NewWorkItemPageProps) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "todo" as ItemType,
    title: "",
    description: "",
    priority: "medium" as Priority,
    labels: "",
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await createWorkItemAction({
        project_id: projectId,
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        labels: toLabels(form.labels).length ? toLabels(form.labels) : undefined,
      });
      if (!result.success) {
        setError(result.error || "Failed to create the task");
        return;
      }
      router.push(`/projects/${projectId}/work-items`);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New task"
        description="A todo, a bug or a change on this project's board"
        actions={
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}/work-items`}>
              <ArrowLeft strokeWidth={1.75} />
              Back to board
            </Link>
          </Button>
        }
      />
      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormLayout
            rail={
              <Panel className="grid gap-2.5 p-3.5">
                <p className="text-[11px] font-medium text-fg-4">PREVIEW ON THE BOARD</p>
                <div className="rounded-md border border-line bg-canvas p-2.5">
                  <p className="flex items-start gap-2">
                    <StatusDot status="idle" className="mt-1.5" />
                    <span className="line-clamp-2 text-[13px] font-medium text-fg">{form.title || "Untitled task"}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-[18px]">
                    <Chip tone={PRIORITY_TONE[form.priority]}>{form.priority}</Chip>
                    <Chip mono>{form.type}</Chip>
                  </div>
                  {toLabels(form.labels).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-[18px]">
                      {toLabels(form.labels)
                        .slice(0, 4)
                        .map((label) => (
                          <Chip key={label}>{label}</Chip>
                        ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] font-medium text-fg-4">WHAT THIS TYPE MEANS</p>
                <p className="text-[12px] text-fg-3">{TYPE_BLURB[form.type]}</p>
                <p className="text-[11px] font-medium text-fg-4">AFTER CREATING</p>
                <p className="text-[12px] text-fg-3">It lands in the Open column; drag it across the board to change its status.</p>
              </Panel>
            }
          >
            {error && <p className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">{error}</p>}

            <FormSection title="Task" description="Describe the work that needs attention.">
              <FormField label="Title" htmlFor="title">
                <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs to be done?" required autoFocus />
              </FormField>
              <FormField label="Description" htmlFor="description" hint="Optional; context, steps to reproduce, links.">
                <Textarea id="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={6} placeholder="Anything the future you will want to know." />
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

            <FormActions note="The task is added to this project's board.">
              <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" loading={isLoading}>
                <Plus strokeWidth={1.75} />
                Create task
              </Button>
            </FormActions>
          </FormLayout>
        </form>
      </PageBody>
    </>
  );
}
