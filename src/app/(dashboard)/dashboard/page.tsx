import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { PageInfoButton } from "@/components/layout/page-info-button";
import { PAGE_INFO } from "@/lib/page-info";
import { DashboardStats } from "./_components/dashboard-stats";
import { RecentActivity } from "./_components/recent-activity";
import { ServiceStatus } from "./_components/service-status";
import { QuickActions } from "./_components/quick-actions";
import { RecentDeploysServer } from "./_components/recent-deploys";
import { Skeleton } from "@/components/ui";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Overview of your projects and services</p>
            </div>
          </div>
          <PageInfoButton {...PAGE_INFO.dashboard} />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
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
    </div>
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
