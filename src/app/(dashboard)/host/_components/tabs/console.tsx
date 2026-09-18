"use client";

import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Loader2, ShieldAlert, Terminal } from "lucide-react";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { Button, Chip, Input, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Entry {
  id: number;
  command: string;
  code: number | null;
  output: string;
  error?: string;
  durationMs: number;
}

const SUGGESTIONS = ["docker ps -a", "docker system df", "docker images", "df -h", "free -m", "docker compose -p marczelloo-dashboard ps", "docker logs --tail 50 dashboard-app"];

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * A console against the agent, not an SSH session: the agent container carries
 * the docker socket and the projects directory, and it only runs the commands
 * on its own allowlist.
 */
export function ConsoleTab() {
  const { run, dialog } = usePinGuard();
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries, running]);

  async function submit(line: string) {
    const text = line.trim();
    if (!text || running) return;
    setRunning(true);
    setCommand("");
    setCursor(null);
    try {
      const result = await run(async () => {
        const response = await fetch("/api/host/exec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: text }),
        });
        return (await response.json().catch(() => ({ success: false, error: "The agent did not answer" }))) as {
          success: boolean;
          requirePin?: boolean;
          error?: string;
          data?: { command: string; code: number; stdout: string; stderr: string; durationMs: number };
        };
      });
      if (!result) return;
      setEntries((current) => [
        ...current,
        result.success && result.data
          ? { id: nextId.current++, command: result.data.command, code: result.data.code, output: [result.data.stdout, result.data.stderr].filter(Boolean).join("\n").trimEnd(), durationMs: result.data.durationMs }
          : { id: nextId.current++, command: text, code: null, output: "", error: result.error ?? "Refused", durationMs: 0 },
      ]);
    } finally {
      setRunning(false);
    }
  }

  function history(direction: -1 | 1) {
    if (entries.length === 0) return;
    const index = cursor === null ? entries.length - 1 : Math.min(entries.length - 1, Math.max(0, cursor + direction));
    setCursor(index);
    setCommand(entries[index].command);
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex items-start gap-2.5 px-3.5 py-3">
        <ShieldAlert className="mt-px size-4 shrink-0 text-warn" strokeWidth={1.75} />
        <p className="text-[12.5px] text-fg-3">
          This runs inside the deploy agent, which holds the docker socket and the projects directory — it is not a shell on the Pi. The agent accepts only its own
          allowlist (docker reads plus start, stop and restart; df, free, uptime, ls, du, git, and file reads inside the projects directory), never a shell, and asks for
          the PIN first.
        </p>
      </Panel>

      <Panel className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line-subtle px-3.5 py-2.5">
          <Terminal className="size-4 text-fg-3" strokeWidth={1.75} />
          <h2 className="text-[13.5px] font-semibold">Console</h2>
          <span className="ml-auto font-mono text-[11px] text-fg-4">{entries.length} run</span>
        </div>

        <div ref={scroller} className="h-[clamp(240px,calc(100vh-520px),520px)] overflow-auto bg-canvas px-3 py-2.5 font-mono text-[11.5px] leading-[1.65]">
          {entries.length === 0 && !running ? (
            <p className="py-10 text-center text-[13px] text-fg-3">Nothing has run yet. Pick one below, or type your own.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="px-1 py-1.5 [&+&]:border-t [&+&]:border-line-subtle">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="text-accent-text">$</span>
                  <span className="text-fg">{entry.command}</span>
                  <span className="ml-auto flex items-center gap-2 text-[10.5px] text-fg-4">
                    {entry.durationMs > 0 && <span>{entry.durationMs} ms</span>}
                    {entry.code !== null && <Chip tone={entry.code === 0 ? "ok" : "err"}>exit {entry.code}</Chip>}
                  </span>
                </p>
                {entry.error && <p className="mt-1 whitespace-pre-wrap text-err">{entry.error}</p>}
                {entry.output && <p className="mt-1 whitespace-pre-wrap break-all text-fg-2">{entry.output}</p>}
                {!entry.error && !entry.output && <p className="mt-1 text-fg-4">no output</p>}
              </div>
            ))
          )}
          {running && (
            <p className="flex items-center gap-2 px-1 py-1.5 text-fg-3">
              <Loader2 className="size-3.5 animate-spin" />
              running…
            </p>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(command);
          }}
          className="flex items-center gap-2 border-t border-line-subtle px-3 py-2.5"
        >
          <span className="font-mono text-[13px] text-accent-text">$</span>
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                history(-1);
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                history(1);
              }
            }}
            placeholder="docker ps -a"
            aria-label="Command"
            className={cn("h-8 flex-1 font-mono", running && "opacity-60")}
            disabled={running}
          />
          <Button type="submit" size="sm" loading={running} disabled={!command.trim()}>
            <CornerDownLeft strokeWidth={1.75} />
            Run
          </Button>
        </form>
      </Panel>

      <Panel className="flex flex-wrap items-center gap-2 px-3.5 py-3">
        <span className="text-[11px] font-medium text-fg-4">TRY</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void submit(suggestion)}
            disabled={running}
            className="rounded-sm border border-line bg-canvas px-2 py-1 font-mono text-[11.5px] text-fg-2 transition-colors duration-quick ease-out hover:border-line-strong hover:text-fg disabled:opacity-45"
          >
            {suggestion}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-fg-4">{entries.length > 0 ? `last run at ${TIME.format(Date.now())}` : "↑ and ↓ walk the history"}</span>
      </Panel>

      {dialog}
    </div>
  );
}
