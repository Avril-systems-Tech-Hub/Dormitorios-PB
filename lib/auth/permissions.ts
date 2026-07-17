/**
 * Helper para permisos basados en módulos (RBAC).
 * Consulta system_roles, system_modules y role_module_permissions desde Supabase.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  durationMs,
  getAuthTraceId,
  logAuthDiagnostic,
} from "@/lib/auth/diagnostics";
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
  const startedAt = performance.now();
  const traceId = await getAuthTraceId();
  const supabase = await createClient();
  const getUserStartedAt = performance.now();
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();
  const getUserMs = durationMs(getUserStartedAt);

  if (!user) {
    logAuthDiagnostic("user-modules", {
      traceId,
      outcome: "no-user",
      errorCode: getUserError?.code ?? null,
      getUserMs,
      totalMs: durationMs(startedAt),
    });
    return [];
  }

  // Obtener el system_role_id del perfil
  const profileStartedAt = performance.now();
  const { data: profile } = await supabase
    .from("profiles")
    .select("system_role_id, role")
    .eq("id", user.id)
    .single();
  const profileMs = durationMs(profileStartedAt);

  if (!profile) {
    logAuthDiagnostic("user-modules", {
      traceId,
      outcome: "no-profile",
      userId: user.id.slice(0, 8),
      getUserMs,
      profileMs,
      totalMs: durationMs(startedAt),
    });
    return [];
  }

  // Si es admin por el campo role legacy y no tiene system_role_id, dar todos los módulos
  if (profile.role === "admin" && !profile.system_role_id) {
    const adminSupabase = createAdminClient();
    const permissionsStartedAt = performance.now();
    const { data: modules } = await adminSupabase
      .from("system_modules")
      .select("key, label, href, sort_order")
      .order("sort_order");
    const permissionsMs = durationMs(permissionsStartedAt);
    logAuthDiagnostic("user-modules", {
      traceId,
      outcome: "legacy-admin",
      userId: user.id.slice(0, 8),
      getUserMs,
      profileMs,
      permissionsMs,
      totalMs: durationMs(startedAt),
    });
    return modules ?? [];
  }

  if (!profile.system_role_id) {
    logAuthDiagnostic("user-modules", {
      traceId,
      outcome: "no-system-role",
      userId: user.id.slice(0, 8),
      getUserMs,
      profileMs,
      totalMs: durationMs(startedAt),
    });
    return [];
  }

  // Consultar módulos del rol
  const adminSupabase = createAdminClient();
  const permissionsStartedAt = performance.now();
  const { data: permissions } = await adminSupabase
    .from("role_module_permissions")
    .select("system_modules(key, label, href, sort_order)")
    .eq("role_id", profile.system_role_id);
  const permissionsMs = durationMs(permissionsStartedAt);

  if (!permissions) {
    logAuthDiagnostic("user-modules", {
      traceId,
      outcome: "no-permissions",
      userId: user.id.slice(0, 8),
      getUserMs,
      profileMs,
      permissionsMs,
      totalMs: durationMs(startedAt),
    });
    return [];
  }

  const modules = permissions
    .map((p) => p.system_modules as unknown as SystemModule)
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);
  logAuthDiagnostic("user-modules", {
    traceId,
    outcome: "ok",
    userId: user.id.slice(0, 8),
    moduleCount: modules.length,
    getUserMs,
    profileMs,
    permissionsMs,
    totalMs: durationMs(startedAt),
  });
  return modules;
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
  const startedAt = performance.now();
  const traceId = await getAuthTraceId();
  const adminSupabase = createAdminClient();
  const { data: role } = await adminSupabase
    .from("system_roles")
    .select("label")
    .eq("id", roleId)
    .single();
  logAuthDiagnostic("role-label", {
    traceId,
    outcome: role ? "ok" : "not-found",
    totalMs: durationMs(startedAt),
  });
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