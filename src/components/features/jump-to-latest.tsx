"use client";

import { ArrowDown } from "lucide-react";

/** Shown over a log viewport while following is paused; the parent must be `relative`. */
export function JumpToLatest({ visible, onClick }: { visible: boolean; onClick(): void }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-sm border border-line-strong bg-surface-raised px-2.5 py-1 text-[11.5px] text-fg-2 shadow-lift transition-colors duration-quick hover:text-fg"
    >
      <ArrowDown className="size-3.5" strokeWidth={1.75} />
      Latest
    </button>
  );
}
