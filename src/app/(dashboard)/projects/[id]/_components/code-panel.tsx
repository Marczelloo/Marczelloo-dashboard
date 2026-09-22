"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Panel, PanelHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * A repository panel on the Code tab: open by default, folds to its header.
 */
export function CodePanel({
  title,
  icon,
  description,
  actions,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Panel>
      <PanelHeader
        title={title}
        icon={icon}
        description={description}
        className={cn(!open && "border-b-0")}
        actions={
          <>
            {open && actions}
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Fold" : "Unfold"}>
              <ChevronDown className={cn("transition-transform duration-quick", !open && "-rotate-90")} strokeWidth={1.75} />
            </Button>
          </>
        }
      />
      {open && children}
    </Panel>
  );
}
