import { Sidebar } from "@/components/layout";
import { DemoBanner } from "@/components/layout/demo-banner";
import { isDemoMode } from "@/lib/demo-mode";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const showDemoBanner = isDemoMode();

  return (
    <div className="min-h-screen bg-background">
      {showDemoBanner && <DemoBanner />}
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 ml-64 min-h-screen ${showDemoBanner ? "pt-0" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
