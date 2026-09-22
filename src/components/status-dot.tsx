import { cn } from "@/lib/utils";
import { toTone, type LegacyStatus, type Tone } from "@/lib/tone";

interface StatusDotProps {
  status: Tone | LegacyStatus;
  size?: "sm" | "md" | "lg";
  /** Legacy flag; a running operation should pass status "live" instead. */
  pulse?: boolean;
  /** Accessible name when the dot is the only carrier of the status. */
  label?: string;
  className?: string;
}

const SIZE = { sm: "size-1.5", md: "size-[7px]", lg: "size-2.5" };

const TONE: Record<Tone, string> = {
  ok: "bg-ok shadow-[0_0_0_3px_rgb(var(--ok)/.1)]",
  live: "bg-info shadow-[0_0_0_3px_rgb(var(--info)/.12)]",
  warn: "bg-warn shadow-[0_0_0_3px_rgb(var(--warn)/.1)]",
  err: "bg-err shadow-[0_0_0_3px_rgb(var(--err)/.1)]",
  idle: "bg-fg-4",
};

export function StatusDot({ status, size = "md", pulse = false, label, className }: StatusDotProps) {
  const tone = toTone(status);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative inline-block shrink-0 rounded-full", SIZE[size], TONE[tone], (tone === "live" || pulse) && "status-live", className)}
    />
  );
}
