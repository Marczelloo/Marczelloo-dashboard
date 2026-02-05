import { projects, services, workItems } from "@/server/data";
import { ProjectsListClient } from "./projects-list-client";

export async function ProjectsList() {
  const allProjects = await projects.getProjects();

  // Fetch stats for all projects in parallel
  const projectsWithStats = await Promise.all(
    allProjects.map(async (project) => {
      const [projectServices, projectWorkItems] = await Promise.all([
        services.getServicesByProjectId(project.id),
        workItems.getOpenWorkItemsByProjectId(project.id),
      ]);

      return {
        ...project,
        servicesCount: projectServices.length,
        healthyServicesCount: projectServices.length, // TODO: Check actual health
        openWorkItemsCount: projectWorkItems.length,
      };
    })
  );

  return <ProjectsListClient projects={projectsWithStats} />;
}
