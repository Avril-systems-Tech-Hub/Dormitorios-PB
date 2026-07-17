/* eslint-disable react-hooks/purity -- Temporary production timing instrumentation. */
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionProfile } from "@/lib/auth/guards";
import { getUserModules, getRoleLabel } from "@/lib/auth/permissions";
import type { SystemModule } from "@/lib/auth/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const startedAt = performance.now();
  const profileStartedAt = performance.now();
  const profile = await getSessionProfile("dashboard-layout");
  const profileMs = Number((performance.now() - profileStartedAt).toFixed(1));
  let modules: SystemModule[] = [];
  let roleLabel = profile.role;

  const modulesStartedAt = performance.now();
  try {
    modules = await getUserModules();
  } catch {
    // Fallback a navegación estática si falla la consulta RBAC
  }
  const modulesMs = Number((performance.now() - modulesStartedAt).toFixed(1));

  // Obtener label real del rol desde system_roles
  const roleLabelStartedAt = performance.now();
  try {
    const label = await getRoleLabel(profile.system_role_id);
    if (label) roleLabel = label;
  } catch {
    // Mantener el fallback al nombre del role
  }
  const roleLabelMs = Number((performance.now() - roleLabelStartedAt).toFixed(1));
  const totalMs = Number((performance.now() - startedAt).toFixed(1));

  return (
    <DashboardShell title="Panel operativo" role={profile.role} roleLabel={roleLabel} userName={profile.full_name} modules={modules}>
      <span
        hidden
        data-auth-diagnostic="dashboard-layout"
        data-profile-ms={profileMs}
        data-modules-ms={modulesMs}
        data-role-label-ms={roleLabelMs}
        data-total-ms={totalMs}
      />
      {children}
    </DashboardShell>
  );
}
