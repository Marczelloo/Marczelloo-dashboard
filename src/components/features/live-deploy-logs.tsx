"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronDown, ChevronUp, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = useCallback(() => {
    if (logsEndRef.current && containerRef.current) {
      const container = containerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        logsEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  // Connect to SSE stream
  useEffect(() => {
    if (!logFile || !isRunning || !expanded) {
      return;
    }

    setError(null);
    setIsConnected(false);

    const es = new EventSource(`/api/deploy/logs/stream?logFile=${encodeURIComponent(logFile)}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "log") {
          const cleanText = stripAnsi(data.line);
          if (cleanText.trim()) {
            setLines((prev) => [
              ...prev,
              {
                id: lineIdRef.current++,
                text: cleanText,
                type: classifyLine(cleanText),
              },
            ]);
          }
        } else if (data.type === "complete") {
          setIsConnected(false);
          es.close();
        } else if (data.type === "error") {
          setError(data.message);
          setIsConnected(false);
          es.close();
        }
      } catch {
        // Raw line without JSON wrapper
        const cleanText = stripAnsi(event.data);
        if (cleanText.trim()) {
          setLines((prev) => [
            ...prev,
            {
              id: lineIdRef.current++,
              text: cleanText,
              type: classifyLine(cleanText),
            },
          ]);
        }
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      // Don't show error for normal stream end
    };

    return () => {
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
    <div className={cn("mt-2 rounded-lg border border-border/50 overflow-hidden", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs">
          {isRunning && isConnected ? (
            <Loader2 className="h-3 w-3 animate-spin text-warning" />
          ) : (
            <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          )}
          <span className="font-medium">Live Logs {stats.total > 0 && `(${stats.total} lines)`}</span>

          {/* Warning/Error counts */}
          {stats.warnings > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3" />
              {stats.warnings}
            </span>
          )}
          {stats.errors > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3 w-3" />
              {stats.errors}
            </span>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Log content */}
      {expanded && (
        <div ref={containerRef} className="max-h-[200px] overflow-auto bg-secondary/20 p-3 font-mono text-xs">
          {error ? (
            <div className="text-destructive">{error}</div>
          ) : lines.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-2">
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
                    "whitespace-pre-wrap break-all leading-relaxed",
                    line.type === "error" && "text-destructive font-medium",
                    line.type === "warning" && "text-warning",
                    line.type === "success" && "text-success",
                    line.type === "info" && "text-primary/80",
                    line.type === "normal" && "text-muted-foreground"
                  )}
                >
                  {line.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
