"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ShellData } from "@/server/shell";
import { MobileDrawer } from "./mobile-drawer";
import { SelfDeploymentProvider, useSelfDeployment } from "./self-deployment";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { browserStorage, readSidebarMode, writeSidebarMode, type SidebarMode } from "./sidebar-preference";

/** Keeps the sidebar mark in sync with the dashboard's own deploy. */
function ShellSidebar(props: Omit<React.ComponentProps<typeof Sidebar>, "markReplayKey">) {
  const { deployment } = useSelfDeployment();
  return <Sidebar {...props} markReplayKey={deployment?.activeJob?.jobId ?? null} />;
}

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("expanded");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => setMode(readSidebarMode(browserStorage())), []);
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleMode = () =>
    setMode((current) => {
      const next = current === "expanded" ? "collapsed" : "expanded";
      writeSidebarMode(browserStorage(), next);
      return next;
    });

  return (
    <SelfDeploymentProvider>
      <div className="group/shell relative min-h-screen bg-canvas">
        <div aria-hidden className="dot-grid pointer-events-none fixed inset-x-0 top-0 h-[420px]" />
        <ShellSidebar mode={mode} counts={data.counts} onToggleMode={toggleMode} className="hidden md:flex" />
        <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} counts={data.counts} />
        <div className={cn("relative flex min-h-screen flex-col transition-[padding] duration-panel ease-out md:pl-14", mode === "expanded" && "xl:pl-[232px]")}>
          <TopBar onOpenMenu={() => setDrawerOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
          <main className="relative flex-1">{children}</main>
        </div>
      </div>
    </SelfDeploymentProvider>
  );
}
