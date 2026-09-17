"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Mark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";
import type { ShellData } from "@/server/shell";
import { FOOTER_LINKS, isActive, NAV_GROUPS, type NavItem } from "./nav";
import type { SidebarMode } from "./sidebar-preference";
import { VersionDisplay } from "./version-display";

interface SidebarNavProps {
  expanded: boolean;
  counts: ShellData["counts"];
  onNavigate?: () => void;
  /** Replays the mark animation, e.g. while the dashboard deploys itself. */
  markReplayKey?: string | null;
}

/** `hidden xl:inline` when the rail may expand on wide screens, always hidden when collapsed. */
function labelClass(expanded: boolean, responsive: boolean) {
  if (!expanded) return "hidden";
  return responsive ? "hidden xl:inline" : "inline";
}

function NavLink({ item, active, expanded, responsive, count, onNavigate }: { item: NavItem; active: boolean; expanded: boolean; responsive: boolean; count?: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] transition-colors duration-quick ease-out",
        active ? "bg-white/[.055] text-white" : "text-fg-2 hover:bg-white/[.04] hover:text-fg"
      )}
    >
      {active && <span aria-hidden className="absolute -left-2 bottom-2 top-2 w-0.5 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent)/.8)]" />}
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className={cn("truncate", labelClass(expanded, responsive))}>{item.label}</span>
      {count !== undefined && <span className={cn("ml-auto font-mono text-[10.5px] text-fg-3", labelClass(expanded, responsive))}>{count}</span>}
    </Link>
  );
}

export function SidebarNav({ expanded, counts, onNavigate, responsive = false, markReplayKey = null }: SidebarNavProps & { responsive?: boolean }) {
  const pathname = usePathname();
  const label = labelClass(expanded, responsive);
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex h-[52px] shrink-0 items-center gap-2.5 px-3.5">
        <Mark size={26} animate replayKey={markReplayKey} title="Marczelloo Dashboard" />
        <span className={cn("leading-tight", label)}>
          <span className="block text-[13.5px] font-semibold tracking-[-0.01em]">Marczelloo</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-fg-3">Dashboard</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label ?? "root"} className="mt-1">
            {group.label && <p className={cn("px-2.5 pb-1 pt-3 text-[11px] font-medium text-fg-4", label)}>{group.label}</p>}
            {group.label && !expanded && <div aria-hidden className="mx-2.5 my-2 h-px bg-line-subtle" />}
            <div className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  expanded={expanded}
                  responsive={responsive}
                  count={item.countKey ? counts[item.countKey] : undefined}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line-subtle px-2 py-2">
        <div className="flex flex-col gap-px">
          {FOOTER_LINKS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} expanded={expanded} responsive={responsive} onNavigate={onNavigate} />
          ))}
          <a
            href="/cdn-cgi/access/logout"
            title="Sign out"
            className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-fg-3 transition-colors duration-quick hover:bg-err/10 hover:text-err"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
            <span className={label}>Sign out</span>
          </a>
        </div>
        <div className={label}>
          <VersionDisplay />
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  mode: SidebarMode;
  counts: ShellData["counts"];
  onToggleMode(): void;
  markReplayKey?: string | null;
  className?: string;
}

export function Sidebar({ mode, counts, onToggleMode, markReplayKey, className }: SidebarProps) {
  const expanded = mode === "expanded";
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex-col border-r border-line-subtle bg-canvas transition-[width] duration-panel ease-out",
        expanded ? "w-14 xl:w-[232px]" : "w-14",
        className
      )}
    >
      <SidebarNav expanded={expanded} responsive counts={counts} markReplayKey={markReplayKey} />
      <button
        type="button"
        onClick={onToggleMode}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="absolute -right-3 top-[64px] hidden size-6 place-items-center rounded-full border border-line-strong bg-surface-raised text-fg-3 opacity-0 shadow-lift transition-[opacity,color] duration-quick hover:text-fg focus-visible:opacity-100 group-hover/shell:opacity-100 xl:grid"
      >
        {expanded ? <PanelLeftClose className="size-3.5" strokeWidth={1.75} /> : <PanelLeftOpen className="size-3.5" strokeWidth={1.75} />}
      </button>
    </aside>
  );
}
