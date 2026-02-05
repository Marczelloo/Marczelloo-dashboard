import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { Header } from "@/components/layout";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { DashboardStats } from "./_components/dashboard-stats";
import { RecentActivity } from "./_components/recent-activity";
import { ServiceStatus } from "./_components/service-status";
import { QuickActions } from "./_components/quick-actions";
import { RecentDeploysServer } from "./_components/recent-deploys";
import { Skeleton } from "@/components/ui";

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" description="Overview of your projects and services">
        <PageInfoButton {...PAGE_INFO.dashboard} />
      </Header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <Suspense fallback={<StatsSkeletons />}>
          <DashboardStats />
        </Suspense>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Service Status - 2 columns, scrollable with max height matching Quick Actions */}
          <div className="lg:col-span-2 max-h-[400px] overflow-hidden flex flex-col">
            <Suspense fallback={<CardSkeleton className="h-full" />}>
              <ServiceStatus />
            </Suspense>
          </div>

          {/* Quick Actions - 1 column */}
          <div>
            <QuickActions />
          </div>
        </div>

        {/* Recent Deploys + Recent Activity - 2 columns side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<CardSkeleton className="h-80" />}>
            <RecentDeploysServer />
          </Suspense>

          <Suspense fallback={<CardSkeleton className="h-80" />}>
            <RecentActivity />
          </Suspense>
        </div>
      </div>
    </>
  );
}

function StatsSkeletons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`rounded-lg ${className}`} />;
}
