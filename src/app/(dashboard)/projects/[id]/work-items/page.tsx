"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Skeleton } from "@/components/ui";
import { getWorkItemsByProjectAction, updateWorkItemAction } from "@/app/actions/work-items";
import { ArrowLeft, Plus, CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import type { WorkItem, WorkItemStatus } from "@/types";
import { formatRelativeTime } from "@/lib/utils";

interface WorkItemsPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkItemsPage({ params }: WorkItemsPageProps) {
  const { id: projectId } = use(params);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  useEffect(() => {
    async function loadItems() {
      const result = await getWorkItemsByProjectAction(projectId);
      if (result.success && result.data) {
        setItems(result.data);
      }
      setIsLoading(false);
    }
    loadItems();
  }, [projectId]);

  const filteredItems = items.filter((item) => {
    if (filter === "open") return item.status !== "done";
    if (filter === "done") return item.status === "done";
    return true;
  });

  const statusGroups = {
    open: filteredItems.filter((i) => i.status === "open"),
    in_progress: filteredItems.filter((i) => i.status === "in_progress"),
    blocked: filteredItems.filter((i) => i.status === "blocked"),
    done: filteredItems.filter((i) => i.status === "done"),
  };

  const handleStatusChange = async (itemId: string, newStatus: WorkItemStatus) => {
    const result = await updateWorkItemAction(itemId, { status: newStatus });
    if (result.success) {
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item)));
    }
  };

  return (
    <>
      <Header title="Work Items" description="Manage tasks, bugs, and changes">
        <div className="flex items-center gap-2">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <Link href={`/projects/${projectId}/work-items/new`}>
            <Button variant="default" size="sm">
              <Plus className="h-4 w-4" />
              New Item
            </Button>
          </Link>
        </div>
      </Header>

      <div className="p-6 space-y-6">
        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {(["all", "open", "done"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "ghost"} size="sm" onClick={() => setFilter(f)}>
              {f === "all" && `All (${items.length})`}
              {f === "open" && `Open (${items.filter((i) => i.status !== "done").length})`}
              {f === "done" && `Done (${items.filter((i) => i.status === "done").length})`}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatusColumn
              title="Open"
              items={statusGroups.open}
              projectId={projectId}
              icon={<Circle className="h-4 w-4" />}
              onStatusChange={handleStatusChange}
            />
            <StatusColumn
              title="In Progress"
              items={statusGroups.in_progress}
              projectId={projectId}
              icon={<Clock className="h-4 w-4 text-warning" />}
              onStatusChange={handleStatusChange}
            />
            <StatusColumn
              title="Blocked"
              items={statusGroups.blocked}
              projectId={projectId}
              icon={<AlertCircle className="h-4 w-4 text-destructive" />}
              onStatusChange={handleStatusChange}
            />
            <StatusColumn
              title="Done"
              items={statusGroups.done}
              projectId={projectId}
              icon={<CheckCircle2 className="h-4 w-4 text-success" />}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No work items yet</p>
              <Link href={`/projects/${projectId}/work-items/new`}>
                <Button>
                  <Plus className="h-4 w-4" />
                  Create First Item
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

interface StatusColumnProps {
  title: string;
  items: WorkItem[];
  projectId: string;
  icon: React.ReactNode;
  onStatusChange: (itemId: string, newStatus: WorkItemStatus) => void;
}

function StatusColumn({ title, items, projectId, icon, onStatusChange }: StatusColumnProps) {
  const typeIcons: Record<string, string> = {
    todo: "📋",
    bug: "🐛",
    feature: "✨",
    change: "🔄",
  };

  const priorityColors: Record<string, "secondary" | "default" | "warning" | "danger"> = {
    low: "secondary",
    medium: "default",
    high: "warning",
    critical: "danger",
  };

  return (
    <Card className="bg-secondary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <Link key={item.id} href={`/projects/${projectId}/work-items/${item.id}`}>
            <div className="rounded-lg bg-background border border-border p-3 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-start gap-2">
                <span className="text-sm">{typeIcons[item.type] || "📋"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={priorityColors[item.priority]} className="text-xs">
                      {item.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(item.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No items</p>}
      </CardContent>
    </Card>
  );
}
