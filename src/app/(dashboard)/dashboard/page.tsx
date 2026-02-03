import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { Header } from "@/components/layout";
import { DashboardStats } from "./_components/dashboard-stats";
import { RecentActivity } from "./_components/recent-activity";
import { ServiceStatus } from "./_components/service-status";
import { QuickActions } from "./_components/quick-actions";
import { Skeleton } from "@/components/ui";

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" description="Overview of your projects and services" />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <Suspense fallback={<StatsSkeletons />}>
          <DashboardStats />
        </Suspense>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Service Status - 2 columns */}
          <div className="lg:col-span-2">
            <Suspense fallback={<CardSkeleton className="h-96" />}>
              <ServiceStatus />
            </Suspense>
          </div>

          {/* Quick Actions - 1 column */}
          <div>
            <QuickActions />
          </div>
        </div>

        {/* Recent Activity */}
        <Suspense fallback={<CardSkeleton className="h-80" />}>
          <RecentActivity />
        </Suspense>
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
