import "server-only";

import { generalTodos, projects, workItems } from "@/server/data";
import { toTaskRows, type TaskList } from "@/lib/tasks";

/** Everything on the list, whichever store it lives in. */
export async function listTasks(): Promise<TaskList> {
  const [allProjects, todos, items] = await Promise.all([
    projects.getProjects({ limit: 1000 }),
    generalTodos.getTodos(),
    workItems.getWorkItems({ limit: 1000 }),
  ]);
  const names = new Map(allProjects.map((project) => [project.id, project.name]));
  return {
    tasks: toTaskRows(todos, items, names),
    projects: allProjects.map((project) => ({ id: project.id, name: project.name })),
  };
}
