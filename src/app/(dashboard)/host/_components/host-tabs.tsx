import Link from "next/link";
import { cn } from "@/lib/utils";

export const HOST_TABS = ["overview", "resources", "containers", "ports", "console", "settings"] as const;

export type HostTab = (typeof HOST_TABS)[number];

const LABEL: Record<HostTab, string> = {
  overview: "Overview",
  resources: "Resources",
  containers: "Containers",
  ports: "Ports",
  console: "Console",
  settings: "Settings",
};

export function hostTabFrom(value: string | string[] | undefined): HostTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return HOST_TABS.find((tab) => tab === candidate) ?? "overview";
}

export function HostTabs({ active }: { active: HostTab }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <nav aria-label="Host sections" className="flex min-w-max items-center gap-0.5 border-b border-line">
        {HOST_TABS.map((tab) => {
          const current = tab === active;
          return (
            <Link
              key={tab}
              href={`/host?tab=${tab}`}
              scroll={false}
              aria-current={current ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap rounded-sm px-2.5 pb-[11px] pt-[9px] text-[13px] font-medium transition-colors duration-quick ease-out",
                current ? "text-fg" : "text-fg-3 hover:text-fg-2"
              )}
            >
              {LABEL[tab]}
              {current && <span aria-hidden className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
