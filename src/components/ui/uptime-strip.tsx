import { cn } from "@/lib/utils";

export type UptimeState = "ok" | "warn" | "down" | "none";

const STATE: Record<UptimeState, { className: string; label: string }> = {
  ok: { className: "bg-ok/70", label: "up" },
  warn: { className: "bg-warn/90", label: "degraded" },
  down: { className: "bg-err", label: "down" },
  none: { className: "bg-white/[.08]", label: "no data" },
};

interface UptimeStripProps {
  buckets: { start: string; state: UptimeState }[];
  className?: string;
}

export function UptimeStrip({ buckets, className }: UptimeStripProps) {
  const down = buckets.filter((bucket) => bucket.state === "down").length;
  const degraded = buckets.filter((bucket) => bucket.state === "warn").length;
  const summary = down || degraded ? `${down} hours down, ${degraded} degraded in the last ${buckets.length} hours` : `No incidents in the last ${buckets.length} hours`;
  return (
    <div role="img" aria-label={summary} className={cn("group/uptime flex h-4 gap-0.5", className)}>
      {buckets.map((bucket) => {
        const hour = new Date(bucket.start).toISOString().slice(11, 16);
        return (
          <span
            key={bucket.start}
            title={`${hour} UTC · ${STATE[bucket.state].label}`}
            className={cn(
              "flex-1 origin-bottom rounded-[2px] transition-[opacity,transform] duration-quick ease-out group-hover/uptime:opacity-50 hover:!opacity-100 hover:scale-y-[1.15]",
              STATE[bucket.state].className
            )}
          />
        );
      })}
    </div>
  );
}
