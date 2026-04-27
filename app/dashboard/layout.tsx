import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionProfile } from "@/lib/auth/guards";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  return (
    <DashboardShell title="Panel operativo" role={profile.role}>
      {children}
    </DashboardShell>
  );
}
