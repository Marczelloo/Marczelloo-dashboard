"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIndicator } from "./use-indicator";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
  "aria-label": string;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className, ...aria }: SegmentedControlProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const indicator = useIndicator(ref, '[data-active="true"]');

  return (
    <div ref={ref} role="radiogroup" aria-label={aria["aria-label"]} className={cn("relative inline-flex gap-0.5 rounded-md border border-line bg-canvas p-0.5", className)}>
      {indicator && (
        <span
          aria-hidden
          className="absolute inset-y-0.5 rounded-[6px] bg-surface-hover shadow-inset-top transition-[left,width] duration-base ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-[1] inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors duration-quick ease-out",
              active ? "text-fg" : "text-fg-3 hover:text-fg-2"
            )}
          >
            {option.label}
            {option.count !== undefined && <span className={cn("font-mono text-[10.5px]", active ? "text-fg-2" : "text-fg-3")}>{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
