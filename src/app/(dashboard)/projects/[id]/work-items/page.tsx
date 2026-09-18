"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Chip, EmptyState, Panel, SegmentedControl, Skeleton } from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import { newTaskDraft, TaskDialog } from "@/components/features/task-dialog";
import { getWorkItemsByProjectAction, updateWorkItemAction } from "@/app/actions/work-items";
import { AlertCircle, ArrowLeft, CheckCircle2, Circle, Clock, GripVertical, ListChecks, Plus } from "lucide-react";
import type { WorkItem, WorkItemStatus } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";

interface WorkItemsPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkItemsPage({ params }: WorkItemsPageProps) {
  const { id: projectId } = use(params);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [adding, setAdding] = useState(false);

  const loadItems = useCallback(async () => {
    const result = await getWorkItemsByProjectAction(projectId);
    if (result.success && result.data) {
      setItems(result.data);
    }
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

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

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination, source } = result;

    // Dropped outside any droppable
    if (!destination) return;

    // Dropped in same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Get the new status from the destination droppable
    const newStatus = destination.droppableId as WorkItemStatus;
    const item = items.find((i) => i.id === draggableId);

    if (!item || item.status === newStatus) return;

    // Optimistically update state
    setItems((prev) => prev.map((i) => (i.id === draggableId ? { ...i, status: newStatus } : i)));

    // Update on server
    const result2 = await updateWorkItemAction(draggableId, { status: newStatus });
    if (result2.success) {
      toast.success(`Moved to ${newStatus.replace("_", " ")}`);
    } else {
      // Revert on failure
      setItems((prev) => prev.map((i) => (i.id === draggableId ? { ...i, status: item.status } : i)));
      toast.error("Failed to update status");
    }
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Tasks, bugs and changes of this project"
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft strokeWidth={1.75} />
                Back to project
              </Link>
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus strokeWidth={1.75} />
              New task
            </Button>
          </>
        }
      />

      <PageBody className="flex flex-col gap-4">
        <SegmentedControl<"all" | "open" | "done">
          aria-label="Filter tasks"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: items.length },
            { value: "open", label: "Open", count: items.filter((item) => item.status !== "done").length },
            { value: "done", label: "Done", count: items.filter((item) => item.status === "done").length },
          ]}
        />

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-lg" />
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatusColumn
                status="open"
                title="Open"
                items={statusGroups.open}
                projectId={projectId}
                icon={<Circle className="size-4 text-fg-3" strokeWidth={1.75} />}
                onStatusChange={handleStatusChange}
              />
              <StatusColumn
                status="in_progress"
                title="In progress"
                items={statusGroups.in_progress}
                projectId={projectId}
                icon={<Clock className="size-4 text-accent" strokeWidth={1.75} />}
                onStatusChange={handleStatusChange}
              />
              <StatusColumn
                status="blocked"
                title="Blocked"
                items={statusGroups.blocked}
                projectId={projectId}
                icon={<AlertCircle className="size-4 text-warn" strokeWidth={1.75} />}
                onStatusChange={handleStatusChange}
              />
              <StatusColumn
                status="done"
                title="Done"
                items={statusGroups.done}
                projectId={projectId}
                icon={<CheckCircle2 className="size-4 text-ok" strokeWidth={1.75} />}
                onStatusChange={handleStatusChange}
              />
            </div>
          </DragDropContext>
        )}

        {!isLoading && items.length === 0 && (
          <Panel>
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Track bugs, changes and todos here; drag a card between columns to change its status."
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus strokeWidth={1.75} />
                  New task
                </Button>
              }
            />
          </Panel>
        )}
      </PageBody>

      {adding && <TaskDialog initial={newTaskDraft(projectId)} onClose={() => setAdding(false)} onSaved={() => void loadItems()} />}
    </>
  );
}

interface StatusColumnProps {
  status: WorkItemStatus;
  title: string;
  items: WorkItem[];
  projectId: string;
  icon: React.ReactNode;
  onStatusChange: (itemId: string, newStatus: WorkItemStatus) => void;
}

function StatusColumn({ status, title, items, projectId, icon, onStatusChange: _onStatusChange }: StatusColumnProps) {
  const priorityTone: Record<string, "neutral" | "warn" | "err" | "idle"> = {
    low: "idle",
    medium: "neutral",
    high: "warn",
    critical: "err",
  };

  return (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-2.5">
        {icon}
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <span className="ml-auto font-mono text-[11px] text-fg-3">{items.length}</span>
      </div>
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex min-h-[120px] flex-1 flex-col gap-2 p-2.5 transition-colors duration-quick ${snapshot.isDraggingOver ? "bg-accent/[.06]" : ""}`}
          >
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`rounded-md border bg-canvas p-2.5 transition-[border-color,box-shadow] duration-quick ease-out ${
                      snapshot.isDragging ? "border-accent/50 shadow-overlay" : "border-line hover:border-line-strong"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        {...provided.dragHandleProps}
                        aria-label="Drag to change status"
                        className="mt-0.5 cursor-grab text-fg-4 transition-colors duration-quick hover:text-fg-2 active:cursor-grabbing"
                      >
                        <GripVertical className="size-4" strokeWidth={1.75} />
                      </div>
                      <StatusDot
                        status={item.status === "blocked" ? "warn" : item.status === "in_progress" ? "live" : item.status === "done" ? "ok" : "idle"}
                        className="mt-1.5"
                      />
                      <Link
                        href={`/projects/${projectId}/work-items/${item.id}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="line-clamp-2 text-[13px] font-medium text-fg">{item.title}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Chip tone={priorityTone[item.priority]}>{item.priority}</Chip>
                          <span className="text-[11px] text-fg-3">{formatRelativeTime(item.updated_at)}</span>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {items.length === 0 && <p className="py-4 text-center text-[11.5px] text-fg-4">Nothing here</p>}
          </div>
        )}
      </Droppable>
    </Panel>
  );
}
