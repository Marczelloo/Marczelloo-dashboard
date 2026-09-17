import { AppShell } from "@/components/layout/app-shell";
import { DemoBanner } from "@/components/layout/demo-banner";
import { isDemoMode } from "@/lib/demo-mode";
import { getShellData } from "@/server/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const data = await getShellData();
  return (
    <>
      {isDemoMode() && <DemoBanner />}
      <AppShell data={data}>{children}</AppShell>
    </>
  );
}
