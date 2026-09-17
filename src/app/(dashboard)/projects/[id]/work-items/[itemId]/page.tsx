"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  FormActions,
  FormLayout,
  FormSection,
} from "@/components/layout/form-layout";
import { Button, Input, Label, Textarea, Skeleton } from "@/components/ui";
import {
  updateWorkItemAction,
  deleteWorkItemAction,
} from "@/app/actions/work-items";
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { WorkItem, WorkItemStatus } from "@/types";
import { formatDateTime } from "@/lib/utils";

interface WorkItemDetailPageProps {
  params: Promise<{ id: string; itemId: string }>;
}

export default function WorkItemDetailPage({
  params,
}: WorkItemDetailPageProps) {
  const { id: projectId, itemId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<WorkItem | null>(null);

  const [formData, setFormData] = useState({
    type: "todo" as "todo" | "bug" | "change",
    title: "",
    description: "",
    status: "open" as WorkItemStatus,
    priority: "medium" as "low" | "medium" | "high" | "critical",
    labels: "",
  });

  useEffect(() => {
    async function loadItem() {
      try {
        const res = await fetch(`/api/work-items/${itemId}`);
        const data = await res.json();
        if (data.workItem) {
          const wi = data.workItem;
          setItem(wi);
          setFormData({
            type: wi.type || "todo",
            title: wi.title || "",
            description: wi.description || "",
            status: wi.status || "open",
            priority: wi.priority || "medium",
            labels: Array.isArray(wi.labels) ? wi.labels.join(", ") : "",
          });
        }
      } catch {
        setError("Failed to load work item");
      }
      setIsLoading(false);
    }
    loadItem();
  }, [itemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const result = await updateWorkItemAction(itemId, {
        type: formData.type,
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        labels: formData.labels
          ? formData.labels
              .split(",")
              .map((l) => l.trim())
              .filter(Boolean)
          : undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to update work item");
        return;
      }

      router.push(`/projects/${projectId}/work-items`);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this work item?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteWorkItemAction(itemId);

      if (!result.success) {
        setError(result.error || "Failed to delete work item");
        return;
      }

      router.push(`/projects/${projectId}/work-items`);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickStatus = async (newStatus: WorkItemStatus) => {
    setFormData((prev) => ({ ...prev, status: newStatus }));
    try {
      await updateWorkItemAction(itemId, { status: newStatus });
    } catch {
      // Revert on error
    }
  };

  const statusButtons: {
    status: WorkItemStatus;
    icon: React.ReactNode;
    label: string;
  }[] = [
    { status: "open", icon: <Circle className="h-4 w-4" />, label: "Open" },
    {
      status: "in_progress",
      icon: <Clock className="h-4 w-4" />,
      label: "In Progress",
    },
    {
      status: "blocked",
      icon: <AlertCircle className="h-4 w-4" />,
      label: "Blocked",
    },
    {
      status: "done",
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Done",
    },
  ];

  if (isLoading) {
    return (
      <>
        <PageHeader title="Work item" description="Loading...">
          <Link href={`/projects/${projectId}/work-items`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </PageHeader>
        <PageBody className="max-w-[720px] space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={formData.title || "Work item"}
        description={item ? `Created ${formatDateTime(item.created_at)}` : ""}
      >
        <Link href={`/projects/${projectId}/work-items`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </PageHeader>

      <PageBody>
        {/* Quick Status Buttons */}
        <div className="flex items-center gap-2 mb-6">
          {statusButtons.map((btn) => (
            <Button
              key={btn.status}
              variant={formData.status === btn.status ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickStatus(btn.status)}
            >
              {btn.icon}
              {btn.label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <FormLayout>
            <FormSection
              title="Task"
              description="Edit the task and its details."
            >
              <div className="grid gap-3.5">
                {error && (
                  <div className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">
                    {error}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <select
                      id="type"
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as "todo" | "bug" | "change",
                        })
                      }
                      className="flex h-8 w-full rounded-sm border border-line-strong bg-canvas px-2.5 text-[13px] text-fg transition-[border-color,box-shadow] duration-quick ease-out hover:border-white/20 focus-visible:border-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15"
                    >
                      <option value="todo">Todo</option>
                      <option value="bug">Bug</option>
                      <option value="change">Change</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as
                            "low" | "medium" | "high" | "critical",
                        })
                      }
                      className="flex h-8 w-full rounded-sm border border-line-strong bg-canvas px-2.5 text-[13px] text-fg transition-[border-color,box-shadow] duration-quick ease-out hover:border-white/20 focus-visible:border-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="labels">Labels (comma-separated)</Label>
                  <Input
                    id="labels"
                    value={formData.labels}
                    onChange={(e) =>
                      setFormData({ ...formData, labels: e.target.value })
                    }
                    placeholder="frontend, ui, performance"
                  />
                </div>
              </div>
            </FormSection>
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSaving}>
                Save changes
              </Button>
            </FormActions>
            <FormSection
              title="Danger zone"
              description="This permanently removes the work item."
              tone="danger"
            >
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="justify-self-start"
                loading={isDeleting}
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
              >
                <Trash2 strokeWidth={1.75} />
                Delete work item
              </Button>
            </FormSection>
          </FormLayout>
        </form>
      </PageBody>
    </>
  );
}
