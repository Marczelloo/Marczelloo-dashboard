import Link from "next/link";
import { cn } from "@/lib/utils";

export const PROJECT_TABS = ["overview", "deployments", "logs", "environment", "domains", "github", "code", "tasks", "settings"] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

const LABEL: Record<ProjectTab, string> = {
  overview: "Overview",
  deployments: "Deployments",
  logs: "Logs",
  environment: "Environment",
  domains: "Domains",
  github: "GitHub",
  code: "Code",
  tasks: "Tasks",
  settings: "Settings",
};

/** `?tab=` value, defaulting to the overview tab. */
export function projectTabFrom(value: string | string[] | undefined): ProjectTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PROJECT_TABS.find((tab) => tab === candidate) ?? "overview";
}

export function ProjectTabs({ projectId, active }: { projectId: string; active: ProjectTab }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <nav aria-label="Project sections" className="flex min-w-max items-center gap-0.5 border-b border-line">
        {PROJECT_TABS.map((tab) => {
          const current = tab === active;
          return (
            <Link
              key={tab}
              href={`/projects/${projectId}?tab=${tab}`}
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
