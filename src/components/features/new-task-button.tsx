"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { newTaskDraft, TaskDialog } from "./task-dialog";

/** Opens the task dialog for a fixed project, wherever a "New task" button sits. */
export function NewTaskButton({
  projectId,
  label = "New task",
  variant = "primary",
  size = "sm",
}: {
  projectId: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus strokeWidth={1.75} />
        {label}
      </Button>
      {open && <TaskDialog initial={newTaskDraft(projectId)} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />}
    </>
  );
}
