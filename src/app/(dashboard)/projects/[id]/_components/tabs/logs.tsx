"use client";

import { useMemo } from "react";
import { LogConsole, type LogSource } from "@/components/features/log-console";
import type { ProjectDetail } from "@/server/projects/detail";

/**
 * Output of every container in the project, merged by time or read one service at a time.
 * The containers come from the agent, so a redeploy or a removed service never
 * leaves the console pointing at a container that is gone.
 */
export function LogsTab({ detail }: { detail: ProjectDetail }) {
  const sources = useMemo<LogSource[]>(() => {
    const endpointId = detail.services.find((service) => service.portainer_endpoint_id)?.portainer_endpoint_id ?? null;
    const containers = detail.agent?.containers ?? [];
    if (containers.length) {
      const sorted = [...containers].sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name));
      const shared = new Set(sorted.filter((container, index) => sorted.findIndex((other) => other.service === container.service) !== index).map((container) => container.service));
      return sorted.map((container) => ({
        id: container.name,
        label: shared.has(container.service) ? container.name : container.service,
        endpointId,
        containerId: container.name,
      }));
    }
    return detail.services
      .filter((service) => service.type === "docker" && service.container_id)
      .map((service) => ({ id: service.id, label: service.name, endpointId: service.portainer_endpoint_id ?? endpointId, containerId: service.container_id as string }));
  }, [detail]);

  return <LogConsole sources={sources} />;
}
