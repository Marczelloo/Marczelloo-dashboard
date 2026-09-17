"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  FormActions,
  FormField,
  FormLayout,
  FormSection,
} from "@/components/layout/form-layout";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { createWorkItemAction } from "@/app/actions/work-items";
import { ArrowLeft, Plus } from "lucide-react";

interface NewWorkItemPageProps {
  params: Promise<{ id: string }>;
}

export default function NewWorkItemPage({ params }: NewWorkItemPageProps) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: "todo" as "todo" | "bug" | "change",
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "critical",
    labels: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await createWorkItemAction({
        project_id: projectId,
        type: formData.type,
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        labels: formData.labels
          ? formData.labels
              .split(",")
              .map((l) => l.trim())
              .filter(Boolean)
          : undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to create work item");
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
        title="New work item"
        description="Create a new task, bug, or change request"
        actions={
          <Link href={`/projects/${projectId}/work-items`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />
      <PageBody>
        <form onSubmit={handleSubmit}>
          <FormLayout>
            {error && (
              <div className="rounded-md border border-err/25 bg-err/10 p-3 text-[13px] text-err">
                {error}
              </div>
            )}
            <FormSection
              title="Task"
              description="Describe the work that needs attention."
            >
              <FormField label="Title" htmlFor="title">
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="What needs to be done?"
                  required
                />
              </FormField>
              <FormField label="Description" htmlFor="description">
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={5}
                  placeholder="Provide more details about this work item..."
                />
              </FormField>
            </FormSection>
            <FormSection
              title="Details"
              description="Classify and prioritize this work item."
            >
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField label="Type" htmlFor="type">
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        type: value as "todo" | "bug" | "change",
                      })
                    }
                  >
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
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        priority: value as
                          "low" | "medium" | "high" | "critical",
                      })
                    }
                  >
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
              <FormField
                label="Labels"
                htmlFor="labels"
                hint="Comma separated."
              >
                <Input
                  id="labels"
                  value={formData.labels}
                  onChange={(e) =>
                    setFormData({ ...formData, labels: e.target.value })
                  }
                  placeholder="frontend, ui, performance"
                />
              </FormField>
            </FormSection>
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isLoading}>
                <Plus className="h-4 w-4" />
                Create work item
              </Button>
            </FormActions>
          </FormLayout>
        </form>
      </PageBody>
    </>
  );
}
