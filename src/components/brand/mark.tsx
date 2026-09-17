"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export type MarkVariant = "obsidian" | "crimson" | "bare";

const VARIANTS: Record<MarkVariant, { tile: string; edge: string; ink: string; dim: string; signal: string; sheen: boolean }> = {
  obsidian: { tile: "#111113", edge: "rgba(255,255,255,.12)", ink: "#ededef", dim: "rgba(237,237,239,.16)", signal: "#e5484d", sheen: true },
  crimson: { tile: "#cf3339", edge: "rgba(255,255,255,.22)", ink: "#ffffff", dim: "rgba(255,255,255,.3)", signal: "#1b0708", sheen: true },
  bare: { tile: "transparent", edge: "transparent", ink: "#ededef", dim: "rgba(237,237,239,.16)", signal: "#e5484d", sheen: false },
};

const INK = 60;
const SIGNAL = 13;
const SIGNAL_OFFSET = 63;
const EASE = "cubic-bezier(.16,1,.3,1)";

interface MarkProps {
  size?: number;
  variant?: MarkVariant;
  /** Fill the ring once on mount and again whenever `replayKey` changes. */
  animate?: boolean;
  replayKey?: string | number | null;
  title?: string;
  className?: string;
}

export function Mark({ size = 28, variant = "obsidian", animate = false, replayKey = null, title, className }: MarkProps) {
  const colors = VARIANTS[variant];
  const sheenId = `mark-sheen-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const inkRef = useRef<SVGRectElement>(null);
  const signalRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ink = inkRef.current?.animate([{ strokeDasharray: "0 100" }, { strokeDasharray: `${INK} 100` }], { duration: 900, easing: EASE, fill: "both" });
    const signal = signalRef.current?.animate(
      [{ opacity: 0, strokeDasharray: "0 100" }, { opacity: 1, strokeDasharray: `${SIGNAL} 100` }],
      { duration: 420, delay: 760, easing: EASE, fill: "both" }
    );
    return () => {
      ink?.cancel();
      signal?.cancel();
    };
  }, [animate, replayKey]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".10" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={colors.tile} />
      {colors.sheen && <rect width="64" height="64" rx="15" fill={`url(#${sheenId})`} />}
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="14.25" fill="none" stroke={colors.edge} strokeWidth="1.5" />
      <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke={colors.dim} strokeWidth="5" />
      <rect ref={inkRef} x="10" y="10" width="44" height="44" rx="11" fill="none" stroke={colors.ink} strokeWidth="5" pathLength={100} strokeDasharray={`${INK} 100`} />
      <rect
        ref={signalRef}
        x="10"
        y="10"
        width="44"
        height="44"
        rx="11"
        fill="none"
        stroke={colors.signal}
        strokeWidth="5"
        pathLength={100}
        strokeDasharray={`${SIGNAL} 100`}
        strokeDashoffset={-SIGNAL_OFFSET}
      />
      <path fill={colors.ink} d="M23.5 39.5V24.5h4.1L32 31l4.4-6.5h4.1v15h-4v-8.6L32 37.3l-4.5-6.4v8.6Z" />
    </svg>
  );
}
