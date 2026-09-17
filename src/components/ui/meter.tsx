import { cn } from "@/lib/utils";

interface MeterProps {
  label: string;
  /** 0–100 */
  value: number;
  display?: string;
  tone?: "neutral" | "warn";
  className?: string;
}

export function Meter({ label, value, display, tone = "neutral", className }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px] text-fg-3">
        <span>{label}</span>
        <span className="font-mono text-[10.5px] text-fg-2">{display ?? `${Math.round(clamped)}%`}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[.07]" role="meter" aria-label={label} aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone === "warn" ? "bg-warn" : "bg-fg-2")} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
