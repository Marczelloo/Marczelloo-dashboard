import { Activity, BookOpen, Box, Cpu, FolderKanban, History, LayoutDashboard, ListChecks, Server, Settings, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: "projects" | "tasks";
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Workspace",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban, countKey: "projects" },
      { href: "/tasks", label: "Tasks", icon: ListChecks, countKey: "tasks" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/host", label: "Host", icon: Cpu },
      { href: "/containers", label: "Containers", icon: Box },
      { href: "/services", label: "Services", icon: Server },
      { href: "/monitoring", label: "Monitoring", icon: Activity },
    ],
  },
  { label: "Activity", items: [{ href: "/audit-log", label: "Audit log", icon: History }] },
];

export const FOOTER_LINKS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/features", label: "Features", icon: Sparkles },
];

export function isActive(pathname: string, href: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function sectionFor(pathname: string): NavItem | null {
  const items = [...NAV_GROUPS.flatMap((group) => group.items), ...FOOTER_LINKS];
  return items.find((item) => isActive(pathname, item.href)) ?? null;
}
