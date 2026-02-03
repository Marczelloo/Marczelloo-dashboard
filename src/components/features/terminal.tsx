"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/components/ui";
import { Terminal as TerminalIcon, Trash2, Lock, Maximize2, Minimize2 } from "lucide-react";

interface HistoryEntry {
  id: string;
  type: "command" | "output" | "error";
  content: string;
  cwd?: string;
}

interface TerminalProps {
  className?: string;
}

export function Terminal({ className }: TerminalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCwd, setCurrentCwd] = useState<string>("~");
  const [hostname, setHostname] = useState<string>("host");
  const [username, setUsername] = useState<string>("user");
  const [pin, setPin] = useState("");
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if DEV_SKIP_PIN mode is enabled
  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.devSkipPin) {
          setIsPinVerified(true);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch system info when terminal is unlocked
  useEffect(() => {
    if (isPinVerified) {
      const fetchInfo = async () => {
        try {
          // Get hostname
          const hostnameRes = await fetch("/api/terminal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: "hostname", pin: pin || undefined }),
          });
          const hostnameData = await hostnameRes.json();
          if (hostnameData.stdout) setHostname(hostnameData.stdout.trim());

          // Get username
          const userRes = await fetch("/api/terminal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: "whoami", pin: pin || undefined }),
          });
          const userData = await userRes.json();
          if (userData.stdout) setUsername(userData.stdout.trim());

          // Get cwd
          const cwdRes = await fetch("/api/terminal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: "pwd", pin: pin || undefined }),
          });
          const cwdData = await cwdRes.json();
          if (cwdData.stdout) setCurrentCwd(cwdData.stdout.trim());

          // Add welcome message
          setHistory([
            {
              id: "welcome",
              type: "output",
              content: `Connected to ${hostnameData.stdout?.trim() || "remote host"}\nType commands below. Use 'clear' to clear screen, ↑/↓ for history.\n`,
            },
          ]);
        } catch {
          setHistory([
            {
              id: "error",
              type: "error",
              content: "Failed to connect to terminal. Check Runner configuration.",
            },
          ]);
        }
      };
      fetchInfo();
    }
  }, [isPinVerified, pin]);

  // Auto-scroll and focus
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history, inputValue]);

  // Keep focus on input
  useEffect(() => {
    if (isPinVerified && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isPinVerified, isLoading, history]);

  const verifyPin = useCallback(async () => {
    if (!pin) {
      setPinError("Please enter your PIN");
      return;
    }
    try {
      const response = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (response.ok) {
        setIsPinVerified(true);
        setPinError(null);
      } else {
        setPinError("Invalid PIN");
      }
    } catch {
      setPinError("Failed to verify PIN");
    }
  }, [pin]);

  const executeCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim()) return;

      // Add command to history
      const cmdEntry: HistoryEntry = {
        id: `cmd-${Date.now()}`,
        type: "command",
        content: cmd,
        cwd: currentCwd,
      };
      setHistory((prev) => [...prev, cmdEntry]);
      setCommandHistory((prev) => [...prev.filter((c) => c !== cmd), cmd]);
      setHistoryIndex(-1);
      setIsLoading(true);

      // Handle clear
      if (cmd.trim() === "clear") {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      try {
        // For cd commands, we need to handle them specially to update cwd
        let actualCommand = cmd;
        if (cmd.trim().startsWith("cd ")) {
          // Run cd followed by pwd to get new directory
          actualCommand = `${cmd} && pwd`;
        }

        const response = await fetch("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: actualCommand,
            cwd: currentCwd === "~" ? undefined : currentCwd,
            pin: pin || undefined,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setHistory((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              type: "error",
              content: result.error || "Command failed",
            },
          ]);
          return;
        }

        // Handle cd command - extract new cwd
        if (cmd.trim().startsWith("cd ")) {
          if (result.success && result.stdout) {
            const newCwd = result.stdout.trim().split("\n").pop() || currentCwd;
            setCurrentCwd(newCwd);
            // Don't show pwd output for cd
          } else if (result.stderr) {
            setHistory((prev) => [
              ...prev,
              {
                id: `out-${Date.now()}`,
                type: "error",
                content: result.stderr,
              },
            ]);
          }
        } else {
          // Regular command - show output
          if (result.stdout) {
            setHistory((prev) => [
              ...prev,
              {
                id: `out-${Date.now()}`,
                type: "output",
                content: result.stdout,
              },
            ]);
          }
          if (result.stderr) {
            setHistory((prev) => [
              ...prev,
              {
                id: `stderr-${Date.now()}`,
                type: "error",
                content: result.stderr,
              },
            ]);
          }
          // Update cwd if changed
          if (result.cwd && result.cwd !== currentCwd) {
            setCurrentCwd(result.cwd);
          }
        }
      } catch (error) {
        setHistory((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "error",
            content: error instanceof Error ? error.message : "Command failed",
          },
        ]);
      } finally {
        setIsLoading(false);
        // Re-focus input after command
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [currentCwd, pin]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      executeCommand(inputValue);
      setInputValue("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue("");
      }
    } else if (e.key === "c" && e.ctrlKey) {
      // Ctrl+C to cancel
      if (isLoading) {
        setIsLoading(false);
      }
      setInputValue("");
    } else if (e.key === "l" && e.ctrlKey) {
      // Ctrl+L to clear
      e.preventDefault();
      setHistory([]);
    }
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const getPrompt = (cwd?: string) => {
    const dir = cwd || currentCwd;
    return (
      <span className="select-none">
        <span className="text-green-400">
          {username}@{hostname}
        </span>
        <span className="text-zinc-500">:</span>
        <span className="text-blue-400">{dir}</span>
        <span className="text-zinc-500">$ </span>
      </span>
    );
  };

  // PIN verification screen
  if (!isPinVerified) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Terminal Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">Enter your PIN to access the terminal</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyPin();
              }}
              className="flex gap-2"
            >
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-32 text-center font-mono"
                maxLength={10}
              />
              <Button type="submit">Unlock</Button>
            </form>
            {pinError && <p className="text-sm text-destructive">{pinError}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  const terminalHeight = isFullscreen ? "h-[calc(100vh-200px)]" : "h-[500px]";

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between py-2 px-4 border-b border-zinc-800 bg-zinc-900">
        <CardTitle className="flex items-center gap-2 text-sm font-normal text-zinc-400">
          <TerminalIcon className="h-4 w-4" />
          <span>
            {username}@{hostname}
          </span>
          <span className="text-zinc-600">—</span>
          <span className="text-zinc-500 font-mono text-xs">{currentCwd}</span>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
            onClick={() => setHistory([])}
            title="Clear (Ctrl+L)"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={terminalRef}
          className={`${terminalHeight} overflow-y-auto bg-zinc-950 p-3 font-mono text-sm cursor-text`}
          onClick={focusInput}
        >
          {/* History */}
          {history.map((entry) => (
            <div key={entry.id} className="leading-relaxed">
              {entry.type === "command" && (
                <div className="flex flex-wrap">
                  {getPrompt(entry.cwd)}
                  <span className="text-zinc-100">{entry.content}</span>
                </div>
              )}
              {entry.type === "output" && (
                <pre className="text-zinc-300 whitespace-pre-wrap break-all">{entry.content}</pre>
              )}
              {entry.type === "error" && (
                <pre className="text-red-400 whitespace-pre-wrap break-all">{entry.content}</pre>
              )}
            </div>
          ))}

          {/* Current input line */}
          <div className="flex flex-wrap items-center">
            {getPrompt()}
            <div className="flex-1 relative min-w-[100px]">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="w-full bg-transparent text-zinc-100 outline-none caret-zinc-100 font-mono"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {isLoading && <span className="absolute left-0 top-0 text-zinc-500 animate-pulse">Running...</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
