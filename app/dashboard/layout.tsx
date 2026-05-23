import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionProfile } from "@/lib/auth/guards";
import { getUserModules, getRoleLabel } from "@/lib/auth/permissions";
import type { SystemModule } from "@/lib/auth/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  let modules: SystemModule[] = [];
  let roleLabel = profile.role;

  try {
    modules = await getUserModules();
  } catch {
    // Fallback a navegación estática si falla la consulta RBAC
  }

  // Obtener label real del rol desde system_roles
  try {
    const label = await getRoleLabel(profile.system_role_id);
    if (label) roleLabel = label;
  } catch {
    // Mantener el fallback al nombre del role
  }

  return (
    <DashboardShell title="Panel operativo" role={profile.role} roleLabel={roleLabel} userName={profile.full_name} modules={modules}>
      {children}
    </DashboardShell>
  );
}
