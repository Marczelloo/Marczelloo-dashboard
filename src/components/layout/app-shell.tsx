"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ShellData } from "@/server/shell";
import { MobileDrawer } from "./mobile-drawer";
import { Sidebar } from "./sidebar";
import { browserStorage, readSidebarMode, writeSidebarMode, type SidebarMode } from "./sidebar-preference";

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("expanded");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setMode(readSidebarMode(browserStorage())), []);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const toggleMode = () =>
    setMode((current) => {
      const next = current === "expanded" ? "collapsed" : "expanded";
      writeSidebarMode(browserStorage(), next);
      return next;
    });

  return (
    <div className="group/shell relative min-h-screen bg-canvas">
      <div aria-hidden className="dot-grid pointer-events-none fixed inset-x-0 top-0 h-[420px]" />
      <Sidebar mode={mode} counts={data.counts} onToggleMode={toggleMode} className="hidden md:flex" />
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} counts={data.counts} />
      <div className={cn("relative flex min-h-screen flex-col transition-[padding] duration-panel ease-out md:pl-14", mode === "expanded" && "xl:pl-[232px]")}>
        {/* Replaced by <TopBar> in Task 9. */}
        <header className="sticky top-0 z-30 flex h-[52px] items-center border-b border-line-subtle bg-canvas/80 px-4 backdrop-blur-md md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
            <Menu strokeWidth={1.75} />
          </Button>
        </header>
        <main className="relative flex-1">{children}</main>
      </div>
    </div>
  );
}
