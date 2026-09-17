"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ShellData } from "@/server/shell";
import { SidebarNav } from "./sidebar";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  counts: ShellData["counts"];
}

export function MobileDrawer({ open, onOpenChange, counts }: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in md:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] border-r border-line-strong bg-canvas shadow-overlay focus:outline-none data-[state=open]:animate-drawer-in md:hidden">
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <SidebarNav expanded counts={counts} onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
