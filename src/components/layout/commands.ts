import type { ShellProject } from "@/server/shell";
import { FOOTER_LINKS, NAV_GROUPS } from "./nav";

export type CommandKind = "page" | "project" | "action";

export interface Command {
  id: string;
  kind: CommandKind;
  label: string;
  hint?: string;
  href?: string;
  deployProjectId?: string;
  keywords: string[];
}

const KIND_ORDER: Record<CommandKind, number> = { page: 0, project: 1, action: 2 };

export function buildCommands(projects: ShellProject[]): Command[] {
  const pages: Command[] = [...NAV_GROUPS.flatMap((group) => group.items), ...FOOTER_LINKS].map((item) => ({
    id: `page:${item.href}`,
    kind: "page",
    label: item.label,
    href: item.href,
    keywords: [item.label.toLowerCase()],
  }));
  const projectCommands: Command[] = projects.flatMap((project) => {
    const keywords = [project.name.toLowerCase(), project.slug.toLowerCase()];
    const deployments = `/projects/${project.id}?tab=deployments`;
    return [
      { id: `project:${project.id}`, kind: "project", label: project.name, hint: project.slug, href: `/projects/${project.id}`, keywords },
      { id: `deploy:${project.id}`, kind: "action", label: `Deploy ${project.name}`, deployProjectId: project.id, keywords },
      { id: `logs:${project.id}`, kind: "action", label: `Open ${project.name} deployments`, href: deployments, keywords },
      { id: `rollback:${project.id}`, kind: "action", label: `Roll back ${project.name}`, hint: "choose a release", href: deployments, keywords },
    ];
  });
  return [...pages, ...projectCommands];
}

function score(command: Command, query: string): number | null {
  const label = command.label.toLowerCase();
  if (label.startsWith(query)) return 0;
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 1;
  if (label.includes(query)) return 2;
  if (command.keywords.some((keyword) => keyword.includes(query))) return 3;
  return null;
}

export function filterCommands(commands: Command[], query: string, limit = 12): Command[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands.filter((command) => command.kind !== "action").slice(0, limit);
  return commands
    .map((command) => ({ command, rank: score(command, normalized) }))
    .filter((entry): entry is { command: Command; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || KIND_ORDER[a.command.kind] - KIND_ORDER[b.command.kind] || a.command.label.localeCompare(b.command.label))
    .slice(0, limit)
    .map((entry) => entry.command);
}
