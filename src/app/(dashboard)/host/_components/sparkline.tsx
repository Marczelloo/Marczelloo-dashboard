"use client";

import { cn } from "@/lib/utils";

/** A reading over the session, drawn small: no axes, no legend, just the shape. */
export function Sparkline({ values, tone = "neutral", className }: { values: number[]; tone?: "neutral" | "warn" | "err"; className?: string }) {
  const stroke = tone === "err" ? "rgb(var(--err))" : tone === "warn" ? "rgb(var(--warn))" : "rgb(var(--fg-2))";
  if (values.length < 2) {
    return <div className={cn("flex h-[52px] items-center justify-center text-[11px] text-fg-4", className)}>collecting…</div>;
  }

  const width = 240;
  const height = 52;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / span) * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-hidden className={cn("h-[52px] w-full", className)}>
      <polyline points={`0,${height} ${points.join(" ")} ${width},${height}`} fill={stroke} fillOpacity={0.07} stroke="none" />
      <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
