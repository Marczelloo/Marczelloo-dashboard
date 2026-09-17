import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-[11.5px] font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line bg-white/[.02] text-fg-2",
        ok: "border-ok/20 bg-ok/10 text-ok",
        warn: "border-warn/25 bg-warn/10 text-warn",
        err: "border-err/25 bg-err/10 text-err",
        live: "border-accent/40 bg-accent/10 text-accent-text",
        idle: "border-line bg-transparent text-fg-3",
      },
      mono: { true: "font-mono text-[11px]", false: "" },
    },
    defaultVariants: { tone: "neutral", mono: false },
  }
);

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {}

export function Chip({ className, tone, mono, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone, mono }), className)} {...props} />;
}

export { chipVariants };
