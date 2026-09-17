import "server-only";

import { generalTodos, projects, workItems } from "@/server/data";
import { ttlCache } from "@/server/lib/ttl-cache";

export interface ShellProject {
  id: string;
  name: string;
  slug: string;
}

export interface ShellData {
  projects: ShellProject[];
  counts: { projects: number; tasks: number };
}

const EMPTY: ShellData = { projects: [], counts: { projects: 0, tasks: 0 } };

const load = ttlCache(60_000, async (): Promise<ShellData> => {
  const [allProjects, todos, items] = await Promise.all([projects.getProjects({ limit: 1000 }), generalTodos.getActiveTodos(), workItems.getOpenWorkItems()]);
  const visible = allProjects.filter((project) => project.status !== "archived").sort((a, b) => a.name.localeCompare(b.name));
  return {
    projects: visible.map(({ id, name, slug }) => ({ id, name, slug })),
    counts: { projects: visible.length, tasks: todos.length + items.length },
  };
});

/** Navigation counts and the command palette's project list; never throws. */
export async function getShellData(): Promise<ShellData> {
  try {
    return await load();
  } catch (error) {
    console.error("[shell] Failed to load shell data:", error);
    return EMPTY;
  }
}
