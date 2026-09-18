"use client";

import { useMemo } from "react";
import { LogConsole, type LogSource } from "@/components/features/log-console";
import type { Service } from "@/types";

/** Output of every container in the project, merged by time or read one service at a time. */
export function LogsTab({ services }: { services: Service[] }) {
  const sources = useMemo<LogSource[]>(
    () =>
      services
        .filter((service) => service.type === "docker" && service.container_id && service.portainer_endpoint_id)
        .map((service) => ({
          id: service.id,
          label: service.name,
          endpointId: service.portainer_endpoint_id as number,
          containerId: service.container_id as string,
        })),
    [services]
  );

  return <LogConsole sources={sources} />;
}
