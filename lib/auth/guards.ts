import { redirect } from "next/navigation";
import {
  durationMs,
  getAuthTraceId,
  logAuthDiagnostic,
} from "@/lib/auth/diagnostics";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";

type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  system_role_id?: string | null;
  is_disabled?: boolean;
};

const AUTH_BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

export async function getSessionProfile(caller = "unspecified") {
  const startedAt = performance.now();
  const traceId = await getAuthTraceId();
  if (AUTH_BYPASS) {
    return {
      id: "dev-bypass-user",
      role: "admin" as const,
      full_name: "Dev Bypass",
      system_role_id: null,
    };
  }

  const clientStartedAt = performance.now();
  const supabase = await createClient();
  const clientMs = durationMs(clientStartedAt);
  const getUserStartedAt = performance.now();
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();
  const getUserMs = durationMs(getUserStartedAt);

  if (!user) {
    logAuthDiagnostic("session-profile", {
      traceId,
      caller,
      outcome: "no-user",
      errorCode: getUserError?.code ?? null,
      clientMs,
      getUserMs,
      totalMs: durationMs(startedAt),
    });
    redirect("/login");
  }

  const profileStartedAt = performance.now();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, system_role_id, is_disabled")
    .eq("id", user.id)
    .single<Profile>();
  const profileMs = durationMs(profileStartedAt);

  if (!profile) {
    logAuthDiagnostic("session-profile", {
      traceId,
      caller,
      outcome: "no-profile",
      userId: user.id.slice(0, 8),
      errorCode: profileError?.code ?? null,
      clientMs,
      getUserMs,
      profileMs,
      totalMs: durationMs(startedAt),
    });
    redirect("/login");
  }

  if (profile.is_disabled) {
    logAuthDiagnostic("session-profile", {
      traceId,
      caller,
      outcome: "disabled",
      userId: user.id.slice(0, 8),
      clientMs,
      getUserMs,
      profileMs,
      totalMs: durationMs(startedAt),
    });
    redirect("/login?staff=1&error=" + encodeURIComponent("Tu cuenta ha sido deshabilitada. Contacta al administrador."));
  }

  logAuthDiagnostic("session-profile", {
    traceId,
    caller,
    outcome: "ok",
    userId: user.id.slice(0, 8),
    clientMs,
    getUserMs,
    profileMs,
    totalMs: durationMs(startedAt),
  });
  return profile;
}

export async function requireRole(allowed: UserRole[]) {
  const profile = await getSessionProfile();
  if (!allowed.includes(profile.role)) {
    redirect("/dashboard");
  }
  return profile;
}

/**
 * Verifica que el usuario actual tenga acceso a un módulo específico.
 * Consulta role_module_permissions usando el admin client.
 * Redirige a /dashboard si no tiene acceso.
 */
export async function requireModulePermission(moduleKey: string) {
  const profile = await getSessionProfile();

  // Admin legacy siempre tiene acceso a todo
  if (profile.role === "admin") {
    return profile;
  }

  // Si tiene system_role_id, verificar permisos en la tabla
  if (profile.system_role_id) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();

    const { data: permission } = await adminSupabase
      .from("role_module_permissions")
      .select("role_id")
      .eq("role_id", profile.system_role_id!)
      .limit(1);

    // Verificar si tiene el módulo específico
    const { data: moduleData } = await adminSupabase
      .from("system_modules")
      .select("id")
      .eq("key", moduleKey)
      .single();

    if (moduleData && profile.system_role_id) {
      const { data: hasPermission } = await adminSupabase
        .from("role_module_permissions")
        .select("role_id")
        .eq("role_id", profile.system_role_id)
        .eq("module_id", moduleData.id)
        .maybeSingle();

      if (hasPermission) {
        return profile;
      }
    }
  }

  // Sin acceso
  redirect("/dashboard");
}