import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-5 py-9 text-center", className)}>
      <div className="mb-1.5 grid size-11 place-items-center rounded-lg border border-line bg-surface-raised text-fg-3 shadow-inset-top">
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="max-w-[36ch] text-[13px] text-fg-3">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
