"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/components/ui";
import { Terminal as TerminalIcon, Trash2, Lock, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [isUserSelecting, setIsUserSelecting] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

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
              content: `Connected to ${hostnameData.stdout?.trim() || "remote host"}\nType commands below. Use 'clear' to clear screen, ↑/↓ for history.\nShortcuts: Ctrl+C (cancel), Ctrl+L (clear), Ctrl+A/E (home/end), Ctrl+U/K (delete line)\n`,
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

  // Track mouse selection state
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // If clicking inside terminal, mark as potential selection start
      if (terminalRef.current?.contains(e.target as Node)) {
        // Don't mark as selecting if clicking on input
        if (e.target !== inputRef.current) {
          setIsUserSelecting(true);
        }
      }
    };

    const handleMouseUp = () => {
      // Delay clearing selection state to allow copy operations
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          setIsUserSelecting(false);
        }
      }, 100);
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        setIsUserSelecting(true);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  // Auto-scroll only when not selecting
  useEffect(() => {
    if (terminalRef.current && !isUserSelecting) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      });
    }
  }, [history, isUserSelecting]);

  // Focus input when clicking in terminal area (but not when selecting)
  const focusInput = useCallback(() => {
    // Only focus if not currently selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return; // Don't focus if text is selected
    }
    inputRef.current?.focus();
  }, []);

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
    const input = inputRef.current;
    if (!input) return;

    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      executeCommand(inputValue);
      setInputValue("");
      setCursorPosition(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        const newValue = commandHistory[commandHistory.length - 1 - newIndex] || "";
        setInputValue(newValue);
        // Set cursor to end
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = newValue.length;
        }, 0);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const newValue = commandHistory[commandHistory.length - 1 - newIndex] || "";
        setInputValue(newValue);
        // Set cursor to end
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = newValue.length;
        }, 0);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue("");
      }
    } else if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case "c":
          // Ctrl+C: Cancel or clear input
          e.preventDefault();
          if (isLoading) {
            setIsLoading(false);
          }
          if (inputValue) {
            // Add cancelled command to history display
            setHistory((prev) => [
              ...prev,
              {
                id: `cmd-${Date.now()}`,
                type: "command",
                content: inputValue,
                cwd: currentCwd,
              },
              {
                id: `cancel-${Date.now()}`,
                type: "error",
                content: "^C",
              },
            ]);
          }
          setInputValue("");
          setCursorPosition(0);
          break;
        case "l":
          // Ctrl+L: Clear screen
          e.preventDefault();
          setHistory([]);
          break;
        case "a":
          // Ctrl+A: Move cursor to beginning of line
          e.preventDefault();
          input.selectionStart = input.selectionEnd = 0;
          break;
        case "e":
          // Ctrl+E: Move cursor to end of line
          e.preventDefault();
          input.selectionStart = input.selectionEnd = inputValue.length;
          break;
        case "u":
          // Ctrl+U: Delete from cursor to beginning of line
          e.preventDefault();
          const posU = input.selectionStart || 0;
          setInputValue(inputValue.slice(posU));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = 0;
          }, 0);
          break;
        case "k":
          // Ctrl+K: Delete from cursor to end of line
          e.preventDefault();
          const posK = input.selectionStart || 0;
          setInputValue(inputValue.slice(0, posK));
          break;
        case "w":
          // Ctrl+W: Delete word before cursor
          e.preventDefault();
          const posW = input.selectionStart || 0;
          const beforeCursor = inputValue.slice(0, posW);
          const afterCursor = inputValue.slice(posW);
          // Find last word boundary before cursor
          const lastWord = beforeCursor.replace(/\s*\S+\s*$/, "");
          setInputValue(lastWord + afterCursor);
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = lastWord.length;
          }, 0);
          break;
        case "d":
          // Ctrl+D: Delete character under cursor OR exit if empty
          e.preventDefault();
          if (inputValue.length === 0) {
            // Could add exit behavior here if needed
          } else {
            const posD = input.selectionStart || 0;
            setInputValue(inputValue.slice(0, posD) + inputValue.slice(posD + 1));
            setTimeout(() => {
              input.selectionStart = input.selectionEnd = posD;
            }, 0);
          }
          break;
        case "b":
          // Ctrl+B: Move cursor back one character
          e.preventDefault();
          const posB = input.selectionStart || 0;
          input.selectionStart = input.selectionEnd = Math.max(0, posB - 1);
          break;
        case "f":
          // Ctrl+F: Move cursor forward one character
          e.preventDefault();
          const posF = input.selectionStart || 0;
          input.selectionStart = input.selectionEnd = Math.min(inputValue.length, posF + 1);
          break;
        case "p":
          // Ctrl+P: Previous command (same as arrow up)
          e.preventDefault();
          if (commandHistory.length > 0) {
            const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
            setHistoryIndex(newIndex);
            const newValue = commandHistory[commandHistory.length - 1 - newIndex] || "";
            setInputValue(newValue);
            setTimeout(() => {
              input.selectionStart = input.selectionEnd = newValue.length;
            }, 0);
          }
          break;
        case "n":
          // Ctrl+N: Next command (same as arrow down)
          e.preventDefault();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const newValue = commandHistory[commandHistory.length - 1 - newIndex] || "";
            setInputValue(newValue);
            setTimeout(() => {
              input.selectionStart = input.selectionEnd = newValue.length;
            }, 0);
          } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            setInputValue("");
          }
          break;
        case "r":
          // Ctrl+R: Would be reverse search - prevent default browser behavior
          e.preventDefault();
          // Could implement reverse history search here
          break;
      }
    } else if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case "b":
          // Alt+B: Move cursor back one word
          e.preventDefault();
          const posAltB = input.selectionStart || 0;
          const beforeAltB = inputValue.slice(0, posAltB);
          const wordStartAltB = beforeAltB.replace(/\s*\S+$/, "").length;
          input.selectionStart = input.selectionEnd = wordStartAltB;
          break;
        case "f":
          // Alt+F: Move cursor forward one word
          e.preventDefault();
          const posAltF = input.selectionStart || 0;
          const afterAltF = inputValue.slice(posAltF);
          const wordEndMatch = afterAltF.match(/^\s*\S+/);
          const wordEndAltF = wordEndMatch ? posAltF + wordEndMatch[0].length : inputValue.length;
          input.selectionStart = input.selectionEnd = wordEndAltF;
          break;
        case "d":
          // Alt+D: Delete word after cursor
          e.preventDefault();
          const posAltD = input.selectionStart || 0;
          const afterAltD = inputValue.slice(posAltD);
          const newAfter = afterAltD.replace(/^\s*\S+/, "");
          setInputValue(inputValue.slice(0, posAltD) + newAfter);
          break;
      }
    } else if (e.key === "Home") {
      // Home: Move to beginning (let browser handle it but prevent scroll)
    } else if (e.key === "End") {
      // End: Move to end (let browser handle it but prevent scroll)
    } else if (e.key === "Tab") {
      // Tab: Could implement autocomplete
      e.preventDefault();
      // For now, just insert spaces
      const posTab = input.selectionStart || 0;
      const newValue = inputValue.slice(0, posTab) + "    " + inputValue.slice(posTab);
      setInputValue(newValue);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = posTab + 4;
      }, 0);
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

  // Handle click on terminal - focus input unless selecting text
  const handleTerminalClick = (e: React.MouseEvent) => {
    // Only focus if not clicking on an interactive element and not selecting
    if (e.target === terminalRef.current || (e.target as HTMLElement).tagName === "PRE") {
      // Delay to allow selection to be detected
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          focusInput();
        }
      }, 0);
    }
  };

  // PIN verification screen
  if (!isPinVerified) {
    return (
      <Card className={cn("flex flex-col", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Terminal Access
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
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

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between py-2 px-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
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
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto bg-zinc-950 p-3 font-mono text-sm cursor-text select-text min-h-0"
          onClick={handleTerminalClick}
          onMouseDown={(e) => {
            // Allow text selection
            if (e.target !== inputRef.current) {
              setIsUserSelecting(true);
            }
          }}
        >
          {/* History */}
          {history.map((entry) => (
            <div key={entry.id} className="leading-relaxed select-text">
              {entry.type === "command" && (
                <div className="flex flex-wrap">
                  {getPrompt(entry.cwd)}
                  <span className="text-zinc-100 select-text">{entry.content}</span>
                </div>
              )}
              {entry.type === "output" && (
                <pre className="text-zinc-300 whitespace-pre-wrap break-all select-text">{entry.content}</pre>
              )}
              {entry.type === "error" && (
                <pre className="text-red-400 whitespace-pre-wrap break-all select-text">{entry.content}</pre>
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
                onFocus={() => setIsUserSelecting(false)}
                disabled={isLoading}
                className="w-full bg-transparent text-zinc-100 outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:border-none caret-zinc-100 font-mono select-auto"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ outline: "none", boxShadow: "none" }}
              />
              {isLoading && <span className="absolute left-0 top-0 text-zinc-500 animate-pulse">Running...</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
