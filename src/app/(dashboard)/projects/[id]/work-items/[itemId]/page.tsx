"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea, Label, Skeleton } from "@/components/ui";
import { updateWorkItemAction, deleteWorkItemAction } from "@/app/actions/work-items";
import { ArrowLeft, Save, Trash2, CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import type { WorkItem, WorkItemStatus } from "@/types";
import { formatDateTime } from "@/lib/utils";

interface WorkItemDetailPageProps {
  params: Promise<{ id: string; itemId: string }>;
}

export default function WorkItemDetailPage({ params }: WorkItemDetailPageProps) {
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

  const statusButtons: { status: WorkItemStatus; icon: React.ReactNode; label: string }[] = [
    { status: "open", icon: <Circle className="h-4 w-4" />, label: "Open" },
    { status: "in_progress", icon: <Clock className="h-4 w-4" />, label: "In Progress" },
    { status: "blocked", icon: <AlertCircle className="h-4 w-4" />, label: "Blocked" },
    { status: "done", icon: <CheckCircle2 className="h-4 w-4" />, label: "Done" },
  ];

  if (isLoading) {
    return (
      <>
        <Header title="Work Item" description="Loading...">
          <Link href={`/projects/${projectId}/work-items`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </Header>
        <div className="p-6 max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  const typeIcons: Record<string, string> = {
    todo: "📋",
    bug: "🐛",
    change: "🔄",
  };

  return (
    <>
      <Header
        title={`${typeIcons[formData.type] || "📋"} ${formData.title || "Work Item"}`}
        description={item ? `Created ${formatDateTime(item.created_at)}` : ""}
      >
        <Link href={`/projects/${projectId}/work-items`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </Header>

      <div className="p-6 max-w-2xl">
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
          <Card>
            <CardHeader>
              <CardTitle>Edit Work Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "todo" | "bug" | "change" })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="todo">📋 Todo</option>
                    <option value="bug">🐛 Bug</option>
                    <option value="change">🔄 Change</option>
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
                        priority: e.target.value as "low" | "medium" | "high" | "critical",
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="labels">Labels (comma-separated)</Label>
                <Input
                  id="labels"
                  value={formData.labels}
                  onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                  placeholder="frontend, ui, performance"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting || isSaving}>
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>

                <Button type="submit" disabled={isSaving || isDeleting}>
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  );
}
