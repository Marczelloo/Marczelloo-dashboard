"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Server,
  Activity,
  Container,
  Terminal,
  History,
  Settings,
  LogOut,
  BookOpen,
  Cpu,
  CheckSquare,
  Newspaper,
  Sparkles,
  ChevronDown,
  Layers,
  Wrench,
  MonitorCog,
  Gauge,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  collapsible?: boolean;
}

const navCategories: NavCategory[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Gauge,
    collapsible: false,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "work",
    label: "Work",
    icon: Layers,
    collapsible: true,
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/todos", label: "Todos", icon: CheckSquare },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    icon: Server,
    collapsible: true,
    items: [
      { href: "/services", label: "Services", icon: Server },
      { href: "/containers", label: "Containers", icon: Container },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: Activity,
    collapsible: true,
    items: [
      { href: "/monitoring", label: "Uptime", icon: Activity },
      { href: "/pi", label: "Raspberry Pi", icon: Cpu },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    collapsible: true,
    items: [
      { href: "/terminal", label: "Terminal", icon: Terminal },
      { href: "/news", label: "Tech News", icon: Newspaper },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: MonitorCog,
    collapsible: true,
    items: [
      { href: "/audit-log", label: "Audit Log", icon: History },
      { href: "/features", label: "Features", icon: Sparkles },
      { href: "/docs", label: "Documentation", icon: BookOpen },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavCategorySection({
  category,
  pathname,
  isOpen,
  onToggle,
}: {
  category: NavCategory;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasActiveItem = category.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const CategoryIcon = category.icon;

  // For non-collapsible categories (like Overview), render items directly
  if (!category.collapsible) {
    return (
      <div className="mb-2">
        {category.items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/15 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-1">
      {/* Category Header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all",
          hasActiveItem ? "text-primary/90" : "text-muted-foreground/70 hover:text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-2">
          <CategoryIcon className="h-3.5 w-3.5" />
          {category.label}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.div>
      </button>

      {/* Category Items */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-2 border-l border-border/50 pl-2 py-1">
              {category.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  // Initialize open state - categories with active items are open by default
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navCategories.forEach((cat) => {
      if (cat.collapsible) {
        const hasActive = cat.items.some(
          (item) =>
            typeof window !== "undefined" &&
            (window.location.pathname === item.href || window.location.pathname.startsWith(`${item.href}/`))
        );
        initial[cat.id] = hasActive;
      }
    });
    return initial;
  });

  // Update open state when pathname changes - auto-expand category with active item
  useEffect(() => {
    setOpenCategories((prev) => {
      const updates: Record<string, boolean> = { ...prev };
      let hasChanges = false;

      navCategories.forEach((cat) => {
        if (cat.collapsible) {
          const hasActive = cat.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
          if (hasActive && !prev[cat.id]) {
            updates[cat.id] = true;
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updates : prev;
    });
  }, [pathname]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/50 bg-card/95 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border/50 px-5">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
            <span className="text-lg font-bold text-primary-foreground">M</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight leading-tight">Marczelloo</span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">Dashboard</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col p-3 h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/50">
        {navCategories.map((category) => (
          <NavCategorySection
            key={category.id}
            category={category}
            pathname={pathname}
            isOpen={openCategories[category.id] ?? false}
            onToggle={() => toggleCategory(category.id)}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border/50 p-3 bg-card/95">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
