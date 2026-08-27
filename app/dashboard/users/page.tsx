import { CreateUserPanel } from "@/components/dashboard/create-user-panel";
import {
  UserCredentialsCell,
  UserRowActions,
  UserStatusBadge,
} from "@/components/dashboard/user-row-actions";
import { UsersPanel } from "@/components/dashboard/users-panel";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { requireRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllRoles, getAllModules, getRoleModules } from "@/lib/auth/permissions";
import { formatMexicoCityDate } from "@/lib/dates";
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

  let profilesQuery = adminSupabase
    .from("profiles")
    .select("id, full_name, username, role, system_role_id, is_disabled, created_at", {
      count: "exact",
    })
    // Soft-retired staff (historial de pagos) no se listan como cuentas activas.
    .not("full_name", "ilike", "%(eliminado)%");

  if (q) {
    profilesQuery = profilesQuery.ilike("full_name", `%${escapeIlike(q)}%`);
  }

  const { data: pagedProfiles, count } = await profilesQuery
    .order("created_at", { ascending: true })
    .range(from, to);

  const { data: allProfiles } = await adminSupabase
    .from("profiles")
    .select("id, full_name, username, role, system_role_id, is_disabled, created_at")
    .not("full_name", "ilike", "%(eliminado)%")
    .order("created_at", { ascending: true });

  const userIds = (pagedProfiles ?? []).filter((p) => !p.username).map((p) => p.id);
  const emailMap = new Map<string, string>();

  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const { data } = await adminSupabase.auth.admin.getUserById(uid);
        if (data?.user?.email) emailMap.set(uid, data.user.email);
      } catch {
        // continuar
      }
    }),
  );

  const roles = await getAllRoles();
  const allModules = await getAllModules();
  const createRoleOptions = roles.map((r) => ({ id: r.id, name: r.name, label: r.label }));
  const nonAdminRoles = roles.filter((r) => r.name !== "admin");
  const roleOptions = nonAdminRoles.map((r) => ({ id: r.id, label: r.label }));

  const roleModulesMap = new Map<string, string[]>();
  for (const role of roles) {
    const mods = await getRoleModules(role.id);
    roleModulesMap.set(role.id, mods.map((m) => m.key));
  }

  const userRows = (pagedProfiles ?? []).map((p) => {
    const loginKind = p.username ? ("username" as const) : ("email" as const);
    const loginLabel = p.username ?? emailMap.get(p.id) ?? "—";
    const systemRole = roles.find((r) => r.id === p.system_role_id);
    const roleLabel = systemRole?.label ?? p.role ?? "Sin rol";
    const isAdmin = p.role === "admin";

    const nameCell = (
      <UserCredentialsCell
        key={`name-${p.id}`}
        fullName={p.full_name}
        loginLabel={loginLabel}
        loginKind={loginKind}
      />
    );

    const roleCell = <span className="text-sm text-text-main">{roleLabel}</span>;

    const statusCell = <UserStatusBadge isAdmin={isAdmin} isDisabled={p.is_disabled} />;

    const actionsCell = (
      <UserRowActions
        key={`actions-${p.id}`}
        userId={p.id}
        fullName={p.full_name}
        systemRoleId={p.system_role_id}
        isDisabled={p.is_disabled}
        isAdmin={isAdmin}
        isCurrentUser={p.id === profile.id}
        roles={roleOptions}
      />
    );

    return [
      nameCell,
      roleCell,
      formatMexicoCityDate(p.created_at),
      statusCell,
      actionsCell,
    ];
  });

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Usuarios y permisos</h2>
        <p className="mt-1 text-sm text-text-muted">
          Administra quién puede entrar, su usuario/correo y contraseñas. Las contraseñas no se
          pueden recuperar: solo restablecer. Para recepción el acceso es el usuario (ej.{" "}
          <span className="font-medium text-text-main">arturo</span>), sin @.
        </p>
      </Card>

      <CreateUserPanel roles={createRoleOptions} />

      <Card>
        <h3 className="text-base font-semibold text-text-main">Usuarios del sistema</h3>
        <p className="mt-0.5 text-sm text-text-muted">
          Usa la columna Acciones para cambiar rol, activar o desactivar acceso, o eliminar la cuenta.
        </p>
        <div className="mt-3">
          <ResponsiveTable
            headers={["Usuario", "Rol", "Alta", "Estado", "Acciones"]}
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
        </div>
      </Card>

      <UsersPanel
        profiles={allProfiles ?? []}
        allModules={allModules}
        roleModulesMap={roleModulesMap}
        allRoles={roles}
      />
    </div>
  );
}
