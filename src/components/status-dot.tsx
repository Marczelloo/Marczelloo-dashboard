"use client";

import { cn } from "@/lib/utils";

interface StatusDotProps {
  status: "online" | "warning" | "offline" | "unknown";
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-3 h-3",
};

const statusStyles = {
  online: "bg-success shadow-[0_0_8px_hsl(var(--success)/0.5)]",
  warning: "bg-warning shadow-[0_0_8px_hsl(var(--warning)/0.5)]",
  offline: "bg-danger shadow-[0_0_8px_hsl(var(--danger)/0.5)]",
  unknown: "bg-muted-foreground",
};

export function StatusDot({ status, size = "md", pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizeClasses[size],
        statusStyles[status],
        pulse && "animate-pulse",
        className
      )}
    />
  );
}
