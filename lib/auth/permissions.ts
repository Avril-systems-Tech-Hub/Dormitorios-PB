/**
 * Helper para permisos basados en módulos (RBAC).
 * Consulta system_roles, system_modules y role_module_permissions desde Supabase.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SystemModule = {
  key: string;
  label: string;
  href: string;
  sort_order: number;
};

export type SystemRole = {
  id: string;
  name: string;
  label: string;
  is_system: boolean;
};

/**
 * Obtiene los módulos asignados al rol del usuario actual.
 * Usa el campo system_role_id del perfil para consultar role_module_permissions.
 */
export async function getUserModules(): Promise<SystemModule[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Obtener el system_role_id del perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("system_role_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return [];

  // Si es admin por el campo role legacy y no tiene system_role_id, dar todos los módulos
  if (profile.role === "admin" && !profile.system_role_id) {
    const adminSupabase = createAdminClient();
    const { data: modules } = await adminSupabase
      .from("system_modules")
      .select("key, label, href, sort_order")
      .order("sort_order");
    return modules ?? [];
  }

  if (!profile.system_role_id) return [];

  // Consultar módulos del rol
  const adminSupabase = createAdminClient();
  const { data: permissions } = await adminSupabase
    .from("role_module_permissions")
    .select("system_modules(key, label, href, sort_order)")
    .eq("role_id", profile.system_role_id);

  if (!permissions) return [];

  return permissions
    .map((p) => p.system_modules as unknown as SystemModule)
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Verifica si el usuario actual tiene acceso a un módulo específico.
 */
export async function hasModuleAccess(moduleKey: string): Promise<boolean> {
  const modules = await getUserModules();
  return modules.some((m) => m.key === moduleKey);
}

/**
 * Obtiene todos los roles del sistema (para el panel de admin).
 */
export async function getAllRoles(): Promise<SystemRole[]> {
  const adminSupabase = createAdminClient();
  const { data: roles } = await adminSupabase
    .from("system_roles")
    .select("id, name, label, is_system")
    .order("name");
  return roles ?? [];
}

/**
 * Obtiene todos los módulos del sistema.
 */
export async function getAllModules(): Promise<SystemModule[]> {
  const adminSupabase = createAdminClient();
  const { data: modules } = await adminSupabase
    .from("system_modules")
    .select("key, label, href, sort_order")
    .order("sort_order");
  return modules ?? [];
}

/**
 * Obtiene el label de un rol por su ID.
 */
export async function getRoleLabel(roleId: string | null | undefined): Promise<string | null> {
  if (!roleId) return null;
  const adminSupabase = createAdminClient();
  const { data: role } = await adminSupabase
    .from("system_roles")
    .select("label")
    .eq("id", roleId)
    .single();
  return role?.label ?? null;
}

/**
 * Obtiene los módulos asignados a un rol específico.
 */
export async function getRoleModules(roleId: string): Promise<SystemModule[]> {
  const adminSupabase = createAdminClient();
  const { data: permissions } = await adminSupabase
    .from("role_module_permissions")
    .select("system_modules(key, label, href, sort_order)")
    .eq("role_id", roleId);

  if (!permissions) return [];

  return permissions
    .map((p) => p.system_modules as unknown as SystemModule)
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);
}