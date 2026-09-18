"use client";

import { KeyRound } from "lucide-react";
import { EnvManager } from "@/components/features/env-manager";
import { EnvVersionHistory } from "@/components/features/env-version-history";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Service } from "@/types";

export function EnvironmentTab({ service, repoPath }: { service: Service | null; repoPath: string | null }) {
  if (!service) {
    return (
      <Panel>
        <EmptyState icon={KeyRound} title="No docker service" description="Environment variables belong to a docker service. Add one in the project settings first." />
      </Panel>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <EnvManager serviceId={service.id} serviceName={service.name} repoPath={repoPath ?? undefined} />
      <EnvVersionHistory serviceId={service.id} refreshKey={0} />
    </div>
  );
}
