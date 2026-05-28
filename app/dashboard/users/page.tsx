import { requireRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllRoles, getAllModules, getRoleModules } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { UsersPanel } from "@/components/dashboard/users-panel";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole(["admin"]);
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  const adminSupabase = createAdminClient();

  // Página actual de perfiles con filtro de búsqueda
  let profilesQuery = adminSupabase
    .from("profiles")
    .select("id, full_name, role, system_role_id, is_disabled, created_at", { count: "exact" });

  if (q) {
    profilesQuery = profilesQuery.ilike("full_name", `%${escapeIlike(q)}%`);
  }

  const { data: pagedProfiles, count } = await profilesQuery
    .order("created_at", { ascending: true })
    .range(from, to);

  // Perfiles completos para el panel de gestión (no paginados, sin filtro)
  const { data: allProfiles } = await adminSupabase
    .from("profiles")
    .select("id, full_name, role, system_role_id, is_disabled, created_at")
    .order("created_at", { ascending: true });

  // Emails solo para la página actual
  const userIds = (pagedProfiles ?? []).map((p) => p.id);
  const emailMap = new Map<string, string>();
  for (const uid of userIds) {
    try {
      const { data } = await adminSupabase.auth.admin.getUserById(uid);
      if (data?.user?.email) emailMap.set(uid, data.user.email);
    } catch {
      // continuar
    }
  }

  // Obtener roles y módulos
  const roles = await getAllRoles();
  const allModules = await getAllModules();

  // Obtener módulos por cada rol
  const roleModulesMap = new Map<string, string[]>();
  for (const role of roles) {
    const mods = await getRoleModules(role.id);
    roleModulesMap.set(role.id, mods.map((m) => m.key));
  }

  // Construir filas de usuarios
  const userRows = (pagedProfiles ?? []).map((p) => {
    const email = emailMap.get(p.id) ?? "—";
    const systemRole = roles.find((r) => r.id === p.system_role_id);
    const roleLabel = systemRole?.label ?? p.role ?? "Sin rol";
    const isAdmin = p.role === "admin";
    const status = isAdmin ? "🔒 Sistema" : p.is_disabled ? "⛔ Deshabilitado" : "✅ Activo";
    return [
      p.full_name,
      email,
      roleLabel,
      new Date(p.created_at).toLocaleDateString("es-MX"),
      status,
    ];
  });

  // Módulos no admin para roles personalizados
  const nonAdminRoles = roles.filter((r) => r.name !== "admin");

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Gestión de Usuarios</h2>
        <p className="mt-1 text-sm text-text-muted">
          Administra los usuarios del sistema y sus roles. Solo el administrador puede acceder a esta sección.
        </p>
      </Card>

      {/* Tabla de usuarios */}
      <Card>
        <h3 className="text-md font-semibold text-text-main mb-3">Usuarios del sistema</h3>
        <ResponsiveTable
          headers={["Nombre", "Correo", "Rol", "Creado", "Estado"]}
          rows={userRows}
          filterMode="global"
          serverPagination={{
            page,
            pageSize,
            totalCount: count ?? 0,
            searchQuery: q,
            searchPlaceholder: "Buscar por nombre…",
          }}
        />
      </Card>

      {/* Panel de gestión */}
      <UsersPanel
        profiles={allProfiles ?? []}
        roles={nonAdminRoles}
        allModules={allModules}
        roleModulesMap={roleModulesMap}
        allRoles={roles}
        currentUserId={profile.id}
      />
    </div>
  );
}
