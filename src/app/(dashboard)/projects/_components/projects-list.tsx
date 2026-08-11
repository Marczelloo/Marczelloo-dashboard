import { projects, services, workItems } from "@/server/data";
import { ProjectsListClient } from "./projects-list-client";

export async function ProjectsList() {
  const [allProjects, allServices, openWorkItems] = await Promise.all([
    projects.getProjects().catch((error) => {
      console.error("[ProjectsList] Failed to load projects:", error);
      return [];
    }),
    services.getServices().catch((error) => {
      console.error("[ProjectsList] Failed to load services:", error);
      return [];
    }),
    workItems.getOpenWorkItems().catch((error) => {
      console.error("[ProjectsList] Failed to load work items:", error);
      return [];
    }),
  ]);

  // Use the already loaded collections instead of issuing two requests per project.
  const projectsWithStats = allProjects.map((project) => {
    const projectServices = allServices.filter((service) => service.project_id === project.id);
    const projectWorkItems = openWorkItems.filter((workItem) => workItem.project_id === project.id);

    return {
      ...project,
      servicesCount: projectServices.length,
      healthyServicesCount: projectServices.length, // TODO: Check actual health
      openWorkItemsCount: projectWorkItems.length,
    };
  });

  return <ProjectsListClient projects={projectsWithStats} />;
}
