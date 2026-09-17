"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, FolderKanban, Rocket, Search } from "lucide-react";
import { toast } from "sonner";
import { deployProjectAction } from "@/app/actions/projects";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { ShellProject } from "@/server/shell";
import { buildCommands, filterCommands, type Command } from "./commands";

const GROUP_LABEL = { page: "Pages", project: "Projects", action: "Actions" } as const;

interface CommandPaletteProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  projects: ShellProject[];
}

export function CommandPalette({ open, onOpenChange, projects }: CommandPaletteProps) {
  const router = useRouter();
  const guard = usePinGuard();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const commands = useMemo(() => buildCommands(projects), [projects]);
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setSelected(0);
  };

  const execute = async (command: Command) => {
    close();
    if (command.href) {
      router.push(command.href);
      return;
    }
    if (command.deployProjectId) {
      const result = await guard.run(() => deployProjectAction(command.deployProjectId!));
      if (!result) return;
      if (result.success) toast.success(`${command.label} queued`, { description: "Follow it on the project's Deployments tab." });
      else toast.error(`${command.label} failed`, { description: result.error });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[selected]) {
      event.preventDefault();
      void execute(results[selected]);
    }
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content
            onKeyDown={onKeyDown}
            className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-line-strong bg-surface-raised shadow-overlay focus:outline-none data-[state=open]:animate-overlay-in"
          >
            <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
            <div className="flex h-12 items-center gap-2.5 border-b border-line-subtle px-3.5">
              <Search className="size-4 text-fg-3" strokeWidth={1.75} />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(0);
                }}
                placeholder="Search pages and projects, or type an action"
                aria-label="Search commands"
                className="h-full flex-1 bg-transparent text-sm text-fg placeholder:text-fg-4 focus:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div role="listbox" aria-label="Commands" className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              {results.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-fg-3">No matches for “{query}”.</p>}
              {results.map((command, index) => {
                const Icon = command.kind === "project" ? FolderKanban : command.deployProjectId ? Rocket : ArrowRight;
                const header = index === 0 || results[index - 1].kind !== command.kind;
                return (
                  <div key={command.id}>
                    {header && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-fg-4">{GROUP_LABEL[command.kind]}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === selected}
                      onMouseMove={() => setSelected(index)}
                      onClick={() => void execute(command)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors duration-instant",
                        index === selected ? "bg-white/[.06] text-fg" : "text-fg-2"
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
                      <span className="truncate">{command.label}</span>
                      {command.hint && <span className="ml-auto truncate font-mono text-[11px] text-fg-4">{command.hint}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 border-t border-line-subtle px-3.5 py-2 text-[11px] text-fg-4">
              <span>↑↓ move</span>
              <span>↵ run</span>
              <span>esc close</span>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      {guard.dialog}
    </>
  );
}
