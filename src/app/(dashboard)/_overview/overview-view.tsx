"use client";

import { RefreshCw } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Overview } from "@/server/overview/types";
import { ActivityList } from "./activity-list";
import { FleetTable } from "./fleet-table";
import { StatusBar } from "./status-bar";
import { TasksDue } from "./tasks-due";
import { useOverview } from "./use-overview";

export function OverviewView({ initial }: { initial: Overview | null }) {
  const overview = useOverview(initial);
  return (
    <>
      <PageHeader title="Overview" />
      <PageBody className="flex flex-col gap-4">
        {overview ? (
          <>
            <StatusBar overview={overview} />
            <FleetTable overview={overview} />
            <div className="grid gap-4 lg:grid-cols-2">
              <ActivityList items={overview.activity} />
              <TasksDue tasks={overview.tasksDue} now={overview.generatedAt} />
            </div>
          </>
        ) : (
          <EmptyState
            icon={RefreshCw}
            title="Overview is unavailable"
            description="The database or the agent did not answer. The page retries every 15 seconds."
            action={<Button size="sm" variant="secondary" onClick={() => window.location.reload()}>Reload now</Button>}
          />
        )}
      </PageBody>
    </>
  );
}
