"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, ScrollText } from "lucide-react";
import { Button, Chip, EmptyState, Input, Panel, SegmentedControl } from "@/components/ui";
import { cn } from "@/lib/utils";

/** One container whose logs this console can read. */
export interface LogSource {
  id: string;
  label: string;
  endpointId: number;
  containerId: string;
}

interface LogLine {
  key: string;
  source: string;
  time: string;
  sort: number;
  text: string;
  tone: "default" | "warn" | "err";
}

const TAILS = ["100", "300", "1000"] as const;
const REFRESH_MS = 10_000;
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const toneOf = (text: string): LogLine["tone"] => {
  if (/\b(error|fatal|exception|panic|failed)\b/i.test(text)) return "err";
  if (/\bwarn(ing)?\b/i.test(text)) return "warn";
  return "default";
};

/** Docker prefixes each line with an RFC3339 timestamp when asked to; split it off. */
function parseLine(raw: string, source: string, index: number): LogLine | null {
  const line = raw.replace(/\r$/, "");
  if (!line.trim()) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+(.*)$/.exec(line);
  const at = match ? Date.parse(match[1]) : Number.NaN;
  const text = match ? match[2] : line;
  return {
    key: `${source}:${index}`,
    source,
    time: Number.isNaN(at) ? "" : TIME.format(at),
    sort: Number.isNaN(at) ? index : at,
    text,
    tone: toneOf(text),
  };
}

/**
 * Container logs for one service or merged across a whole project.
 * Merged output is ordered by timestamp, so a request crossing services reads in order.
 */
export function LogConsole({ sources, className, height = "h-[clamp(260px,calc(100vh-430px),620px)]" }: { sources: LogSource[]; className?: string; height?: string }) {
  const [scope, setScope] = useState<string>("all");
  const [tail, setTail] = useState<(typeof TAILS)[number]>("300");
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState<"all" | "warn" | "err">("all");
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => (scope === "all" ? sources : sources.filter((source) => source.id === scope)), [scope, sources]);
  const key = selected.map((source) => source.containerId).join(",");

  const load = useCallback(async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        selected.map(async (source) => {
          const response = await fetch("/api/containers/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpointId: source.endpointId, containerId: source.containerId, tail: Number(tail), timestamps: true }),
          });
          const data = (await response.json().catch(() => ({}))) as { logs?: string; error?: string };
          if (!response.ok) throw new Error(data.error ?? `${source.label}: logs unavailable`);
          return (data.logs ?? "").split("\n").map((raw, index) => parseLine(raw, source.label, index));
        })
      );
      const merged = results.flat().filter((line): line is LogLine => line !== null);
      merged.sort((a, b) => a.sort - b.sort);
      setLines(merged);
      setError(null);
      setFetchedAt(TIME.format(Date.now()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the logs");
    } finally {
      setLoading(false);
    }
    // `key` stands in for the selected containers so the callback is stable per selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tail]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, load]);

  const problems = useMemo(() => ({ warn: lines.filter((line) => line.tone !== "default").length, err: lines.filter((line) => line.tone === "err").length }), [lines]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return lines.filter((line) => {
      if (level === "err" && line.tone !== "err") return false;
      if (level === "warn" && line.tone === "default") return false;
      return !needle || line.text.toLowerCase().includes(needle);
    });
  }, [filter, level, lines]);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [visible]);

  if (!sources.length) {
    return (
      <Panel className={className}>
        <EmptyState icon={ScrollText} title="No container to read" description="Logs come from docker services; point a service at its container first." />
      </Panel>
    );
  }

  return (
    <Panel className={cn("flex w-full flex-col self-start overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
          <ScrollText className="size-4 text-fg-3" strokeWidth={1.75} />
          Logs
        </h2>
        {sources.length > 1 && (
          <SegmentedControl
            aria-label="Log source"
            value={scope}
            onChange={setScope}
            options={[{ value: "all", label: "All services" }, ...sources.map((source) => ({ value: source.id, label: source.label }))]}
          />
        )}
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter lines" className="h-[26px] w-[130px] flex-1 text-xs sm:flex-none" aria-label="Filter log lines" />
          <SegmentedControl<"all" | "warn" | "err">
            aria-label="Only problems"
            value={level}
            onChange={setLevel}
            options={[
              { value: "all", label: "All" },
              { value: "warn", label: "Problems", count: problems.warn },
              { value: "err", label: "Errors", count: problems.err },
            ]}
          />
          <SegmentedControl<(typeof TAILS)[number]> aria-label="Lines to read" value={tail} onChange={setTail} options={TAILS.map((value) => ({ value, label: value }))} />
          <Button variant={live ? "primary" : "secondary"} size="sm" onClick={() => setLive((value) => !value)} aria-pressed={live}>
            {live ? <Chip tone="live">live</Chip> : "Live"}
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="Refresh logs">
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw strokeWidth={1.75} />}
          </Button>
        </div>
      </div>

      <div ref={scroller} className={cn("overflow-auto bg-canvas px-3 py-2 font-mono text-[11.5px] leading-[1.65]", height)}>
        {error ? (
          <p className="py-8 text-center text-[13px] text-err">{error}</p>
        ) : loading && !lines.length ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-fg-3" />
          </div>
        ) : !visible.length ? (
          <p className="py-10 text-center text-[13px] text-fg-3">{lines.length ? "No line matches the filter." : "No output yet."}</p>
        ) : (
          visible.map((line) => (
            <p key={line.key} className="flex gap-2.5 whitespace-pre-wrap break-words px-1 py-px hover:bg-white/[.03]">
              {line.time && <span className="shrink-0 text-fg-4">{line.time}</span>}
              {scope === "all" && sources.length > 1 && <span className="shrink-0 text-fg-3">{line.source}</span>}
              <span className={cn("min-w-0", line.tone === "err" && "text-err", line.tone === "warn" && "text-warn", line.tone === "default" && "text-fg-2")}>{line.text}</span>
            </p>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-subtle px-3 py-2 text-[11px] text-fg-3">
        <span className="tabular-nums">
          {visible.length} {visible.length === 1 ? "line" : "lines"}
          {lines.length !== visible.length ? ` of ${lines.length}` : ""}
        </span>
        <span className="tabular-nums">{fetchedAt ? `read at ${fetchedAt}${live ? " · refreshing every 10 s" : ""}` : ""}</span>
      </div>
    </Panel>
  );
}
