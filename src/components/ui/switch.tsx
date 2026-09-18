"use client";

import { cn } from "@/lib/utils";

/** A two-state control that saves on change; no form submit behind it. */
export function Switch({
  checked,
  onChange,
  disabled,
  "aria-label": label,
  className,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
  "aria-label": string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border transition-colors duration-base ease-out disabled:opacity-45",
        checked ? "border-accent/40 bg-accent/25" : "border-line-strong bg-canvas hover:border-white/20",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute size-[12px] rounded-full transition-[left,background-color] duration-base ease-out",
          checked ? "left-[17px] bg-accent" : "left-[2px] bg-fg-4"
        )}
      />
    </button>
  );
}
