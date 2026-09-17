import * as React from "react";
import { chipVariants } from "./chip";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "danger";

const TONE = { default: "neutral", secondary: "neutral", outline: "neutral", destructive: "err", danger: "err", success: "ok", warning: "warn" } as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant | null;
}

/** Legacy badge API rendered as a Chip; new code uses Chip directly. */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(chipVariants({ tone: TONE[variant ?? "default"] }), className)} {...props} />;
}

const badgeVariants = ({ variant }: { variant?: BadgeVariant | null } = {}) => chipVariants({ tone: TONE[variant ?? "default"] });

export { Badge, badgeVariants };
