import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("inline-flex items-center rounded-xs border border-line-strong bg-white/[.03] px-[5px] py-px font-mono text-[10.5px] font-medium text-fg-3", className)} {...props} />;
}
