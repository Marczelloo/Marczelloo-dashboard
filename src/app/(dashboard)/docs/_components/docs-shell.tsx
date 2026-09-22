"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DOC_GROUPS, matchesQuery } from "./doc-index";

const STORAGE_KEY = "docs.nav-open";

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * Section of the page currently under the header, for highlighting its link.
 * `pin` marks a section picked from the menu, so the smooth scroll towards it
 * does not flicker through the ones in between.
 */
function useActiveSection(): [string, (id: string) => void] {
  const [active, setActive] = useState(DOC_GROUPS[0].sections[0].id);
  const pinnedUntil = useRef(0);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-doc-section]"));
    const visible = new Map<string, number>();

    function pick() {
      if (Date.now() < pinnedUntil.current) return;
      // At the very bottom the last sections can never reach the top of the page.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && sections.length) {
        setActive(sections[sections.length - 1].id);
        return;
      }
      const first = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
      if (first) setActive(first[0]);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        pick();
      },
      { rootMargin: "-72px 0px -60% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
    window.addEventListener("scroll", pick, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", pick);
    };
  }, []);

  const pin = useCallback((id: string) => {
    pinnedUntil.current = Date.now() + 900;
    setActive(id);
  }, []);

  return [active, pin];
}

function DocsNav({ active, onPick }: { active: string; onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => DOC_GROUPS.map((group) => ({ ...group, sections: group.sections.filter((link) => matchesQuery(link, group, query)) })).filter((group) => group.sections.length > 0),
    [query]
  );

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    onPick(id);
  }

  return (
    <div className="grid gap-3">
      <label className="relative block">
        <span className="sr-only">Search the docs</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && groups[0]) jump(groups[0].sections[0].id);
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search"
          className="h-8 w-full rounded-md border border-line bg-canvas pl-8 pr-7 text-[13px] text-fg placeholder:text-fg-4 focus:border-line-strong focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-fg-4 hover:text-fg-2">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </label>

      {groups.length === 0 ? (
        <p className="px-2.5 text-[12.5px] text-fg-3">Nothing matches “{query}”.</p>
      ) : (
        <nav aria-label="Docs" className="grid gap-2">
          {groups.map((group) => {
            const open = query ? true : !collapsed[group.id];
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => setCollapsed((current) => ({ ...current, [group.id]: open }))}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between rounded-sm px-2.5 py-1 text-[11.5px] font-medium text-fg-4 transition-colors hover:text-fg-2"
                >
                  {group.label}
                  <ChevronDown className={cn("size-3.5 transition-transform duration-quick", !open && "-rotate-90")} strokeWidth={1.75} />
                </button>
                <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="mt-0.5 grid gap-px">
                      {group.sections.map((link) => {
                        const current = link.id === active;
                        return (
                          <a
                            key={link.id}
                            href={`#${link.id}`}
                            onClick={(event) => {
                              event.preventDefault();
                              jump(link.id);
                            }}
                            aria-current={current ? "location" : undefined}
                            className={cn(
                              "relative rounded-sm px-2.5 py-1.5 text-[13px] transition-colors duration-quick",
                              current ? "bg-white/[.05] text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-accent" : "text-fg-3 hover:bg-white/[.03] hover:text-fg"
                            )}
                          >
                            {link.title}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** Docs page frame: a collapsible, searchable contents rail beside the sections. */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const [active, pin] = useActiveSection();
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setOpen(readOpen());
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // The rail just won't remember its state.
    }
  }

  return (
    <>
      <PageHeader
        title="Docs"
        description="How the dashboard, the agent and the Pi fit together, and how to run them"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={toggle} className="hidden lg:inline-flex">
              {open ? <PanelLeftClose strokeWidth={1.75} /> : <PanelLeftOpen strokeWidth={1.75} />}
              {open ? "Hide contents" : "Contents"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} className="lg:hidden">
              {mobileOpen ? <PanelLeftClose strokeWidth={1.75} /> : <PanelLeftOpen strokeWidth={1.75} />}
              Contents
            </Button>
          </>
        }
      />
      <PageBody>
        <div className={cn("grid gap-6 lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out", open ? "lg:grid-cols-[220px_minmax(0,1fr)]" : "lg:grid-cols-[0px_minmax(0,1fr)] lg:gap-x-0")}>
          <aside className={cn("hidden lg:block", !open && "lg:invisible lg:overflow-hidden")} aria-hidden={!open}>
            <div className="sticky top-[68px] max-h-[calc(100vh-88px)] overflow-y-auto pb-4">
              <DocsNav active={active} onPick={pin} />
            </div>
          </aside>

          <div className="grid min-w-0 gap-4">
            {mobileOpen && (
              <div className="rounded-lg border border-line bg-surface p-3 lg:hidden">
                <DocsNav
                  active={active}
                  onPick={(id) => {
                    pin(id);
                    setMobileOpen(false);
                  }}
                />
              </div>
            )}
            <div className="grid w-full max-w-[920px] gap-4">{children}</div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
