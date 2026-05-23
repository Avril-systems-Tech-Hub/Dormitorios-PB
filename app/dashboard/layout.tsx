import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionProfile } from "@/lib/auth/guards";
import { getUserModules } from "@/lib/auth/permissions";
import type { SystemModule } from "@/lib/auth/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  let modules: SystemModule[] = [];

  try {
    modules = await getUserModules();
  } catch {
    // Fallback a navegación estática si falla la consulta RBAC
  }

  return (
    <DashboardShell title="Panel operativo" role={profile.role} modules={modules}>
      {children}
    </DashboardShell>
  );
}
