"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, ChevronUp, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { JumpToLatest } from "./jump-to-latest";
import { useStickToBottom } from "./use-stick-to-bottom";

interface LiveDeployLogsProps {
  logFile: string;
  isRunning: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

interface LogLine {
  id: number;
  text: string;
  type: "normal" | "warning" | "error" | "success" | "info";
}

// Patterns for log styling
const ERROR_PATTERNS = [
  /error/i,
  /failed/i,
  /fatal/i,
  /exception/i,
  /cannot/i,
  /unable to/i,
  /denied/i,
  /rejected/i,
  /\berr\b/i,
  /failure/i,
  /exit code [1-9]/i,
];

const WARNING_PATTERNS = [
  /warning/i,
  /warn/i,
  /deprecated/i,
  /skipping/i,
  /missing/i,
  /not found/i,
  /could not/i,
  /timeout/i,
  /retry/i,
];

const SUCCESS_PATTERNS = [
  /success/i,
  /completed/i,
  /done/i,
  /✓/,
  /passed/i,
  /running/i,
  /started/i,
  /created/i,
  /built/i,
];

const INFO_PATTERNS = [
  /^step\s+\d+/i,
  /^\d+\/\d+/,
  /pulling/i,
  /downloading/i,
  /extracting/i,
  /building/i,
  /=>/,
  /--->/,
];

function classifyLine(text: string): LogLine["type"] {
  // Check patterns in order of priority
  if (ERROR_PATTERNS.some((p) => p.test(text))) return "error";
  if (WARNING_PATTERNS.some((p) => p.test(text))) return "warning";
  if (SUCCESS_PATTERNS.some((p) => p.test(text))) return "success";
  if (INFO_PATTERNS.some((p) => p.test(text))) return "info";
  return "normal";
}

// Strip ANSI codes from text
function stripAnsi(text: string): string {
  return text.replace(/\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

export function LiveDeployLogs({ logFile, isRunning, defaultExpanded = true, className }: LiveDeployLogsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineIdRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { ref: followRef, onScroll: onFollowScroll, paused: followPaused, jump: jumpToLatest } = useStickToBottom(lines);

  // Connect to SSE stream
  useEffect(() => {
    // A completed job still has useful output. The stream endpoint immediately
    // replays the file and emits a completion event in that case.
    if (!logFile || !expanded) {
      return;
    }

    setError(null);
    setIsConnected(false);
    setLines([]);
    lineIdRef.current = 0;

    const es = new EventSource(`/api/deploy/logs/stream?logFile=${encodeURIComponent(logFile)}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    const handleLog = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const cleanText = stripAnsi(String(data.content || ""));
        if (cleanText.trim()) {
          setLines((prev) => [
            ...prev,
            ...cleanText.split("\n").filter((line: string) => line.trim()).map((line: string) => ({
              id: lineIdRef.current++,
              text: line,
              type: classifyLine(line),
            })),
          ]);
        }
      } catch {
        setError("Invalid log stream response");
      }
    };

    const handleComplete = () => {
      setIsConnected(false);
      es.close();
    };

    const handleStreamError = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setError(data.message || "Failed to read deploy logs");
      } catch {
        setError("Failed to read deploy logs");
      }
      setIsConnected(false);
      es.close();
    };

    es.addEventListener("log", handleLog);
    es.addEventListener("complete", handleComplete);
    es.addEventListener("error", handleStreamError);

    es.onerror = () => {
      setIsConnected(false);
      // Don't show error for normal stream end
    };

    return () => {
      es.removeEventListener("log", handleLog);
      es.removeEventListener("complete", handleComplete);
      es.removeEventListener("error", handleStreamError);
      es.close();
      eventSourceRef.current = null;
    };
  }, [logFile, isRunning, expanded]);

  // Summary stats
  const stats = useMemo(() => {
    const warnings = lines.filter((l) => l.type === "warning").length;
    const errors = lines.filter((l) => l.type === "error").length;
    return { warnings, errors, total: lines.length };
  }, [lines]);

  if (!logFile) return null;

  return (
    <div className={cn("mt-2 rounded-lg border border-line overflow-hidden", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface-raised/30 hover:bg-surface-raised/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs">
          {isRunning && isConnected ? (
            <Loader2 className="h-3 w-3 animate-spin text-info" />
          ) : (
            <span className="h-3 w-3 rounded-full bg-fg-3/30" />
          )}
          <span className="font-medium">Live Logs {stats.total > 0 && `(${stats.total} lines)`}</span>

          {/* Warning/Error counts */}
          {stats.warnings > 0 && (
            <span className="flex items-center gap-1 text-warn">
              <AlertTriangle className="h-3 w-3" />
              {stats.warnings}
            </span>
          )}
          {stats.errors > 0 && (
            <span className="flex items-center gap-1 text-err">
              <XCircle className="h-3 w-3" />
              {stats.errors}
            </span>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-fg-3" />
        ) : (
          <ChevronDown className="h-4 w-4 text-fg-3" />
        )}
      </button>

      {/* Log content */}
      {expanded && (
        <div className="relative">
        <div ref={followRef} onScroll={onFollowScroll} className="max-h-[260px] overflow-auto bg-canvas p-3 font-mono text-xs">
          {error ? (
            <div className="text-err">{error}</div>
          ) : lines.length === 0 ? (
            <div className="text-fg-3 flex items-center gap-2">
              {isConnected ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Waiting for logs...
                </>
              ) : (
                "No logs yet"
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className={cn(
                    "whitespace-pre-wrap break-words leading-relaxed",
                    line.type === "error" && "text-err font-medium",
                    line.type === "warning" && "text-warn",
                    line.type === "success" && "text-ok",
                    line.type === "info" && "text-fg-3",
                    line.type === "normal" && "text-fg-3"
                  )}
                >
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </div>
        <JumpToLatest visible={followPaused} onClick={jumpToLatest} />
        </div>
      )}
    </div>
  );
}
