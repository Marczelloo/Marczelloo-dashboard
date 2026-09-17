"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { DeployIndicator } from "./deploy-indicator";
import { sectionFor } from "./nav";
import { NotificationsDropdown } from "./notifications-dropdown";

interface TopBarProps {
  onOpenMenu(): void;
  onOpenPalette(): void;
}

export function TopBar({ onOpenMenu, onOpenPalette }: TopBarProps) {
  const section = sectionFor(usePathname());
  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-line-subtle bg-canvas/80 px-4 backdrop-blur-md md:px-6">
      <Button variant="ghost" size="icon" className="-ml-1.5 md:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu strokeWidth={1.75} />
      </Button>
      <p className="min-w-0 truncate text-[13px] font-medium text-fg">{section?.label}</p>
      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-auto flex h-[30px] min-w-0 max-w-[260px] flex-1 items-center gap-2 rounded-sm border border-line bg-white/[.02] px-2.5 text-[12.5px] text-fg-4 transition-colors duration-quick ease-out hover:border-line-strong hover:bg-white/[.035] sm:flex-none sm:basis-[260px]"
      >
        <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">Search or run a command</span>
        <Kbd className="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
      </button>
      <DeployIndicator />
      <NotificationsDropdown />
    </header>
  );
}
