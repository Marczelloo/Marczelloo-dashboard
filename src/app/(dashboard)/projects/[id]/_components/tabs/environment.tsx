"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { EnvManager } from "@/components/features/env-manager";
import { EnvVersionHistory } from "@/components/features/env-version-history";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Service } from "@/types";

export function EnvironmentTab({ service, repoPath }: { service: Service | null; repoPath: string | null }) {
  const [refreshKey] = useState(0);
  if (!service) {
    return (
      <Panel>
        <EmptyState icon={KeyRound} title="No docker service" description="Environment variables belong to a docker service. Add one in the project settings first." />
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <EnvManager serviceId={service.id} serviceName={service.name} repoPath={repoPath ?? undefined} />
      <EnvVersionHistory serviceId={service.id} refreshKey={refreshKey} />
    </div>
  );
}
