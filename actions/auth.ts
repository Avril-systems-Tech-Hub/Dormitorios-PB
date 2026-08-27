"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import {
  isValidStaffUsername,
  normalizeStaffUsername,
  staffUsernameToEmail,
} from "@/lib/auth/staff-credentials";
import { roleUsesStaffUsername } from "@/lib/auth/roles";

// ============================================================
// CRUD Usuarios del sistema (solo admin)
// ============================================================

export async function createSystemUserAction(formData: FormData) {
  const actor = await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username = normalizeStaffUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!password || !fullName || !roleId) {
    return redirectWithResult(returnTo, "error", "Todos los campos son obligatorios.");
  }

  if (password.length < 8 || password.length > 128) {
    return redirectWithResult(returnTo, "error", "La contraseña debe tener entre 8 y 128 caracteres.");
  }

  const { data: role } = await adminSupabase
    .from("system_roles")
    .select("id, name")
    .eq("id", roleId)
    .single();

  if (!role) {
    return redirectWithResult(returnTo, "error", "Rol no válido.");
  }
  if (role.name === "admin" && formData.get("admin_confirmation") !== "on") {
    return redirectWithResult(
      returnTo,
      "error",
      "Confirma explícitamente el acceso total antes de crear otro administrador.",
    );
  }

  const usesUsername = roleUsesStaffUsername(role.name);
  if (usesUsername && !isValidStaffUsername(username)) {
    return redirectWithResult(
      returnTo,
      "error",
      "El usuario debe tener entre 3 y 32 caracteres y usar solo letras minúsculas, números, punto, guion o guion bajo.",
    );
  }
  if (!usesUsername && !email) {
    return redirectWithResult(returnTo, "error", "El correo electrónico es obligatorio para este rol.");
  }

  if (usesUsername) {
    const { data: existingProfile, error: usernameLookupError } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (usernameLookupError) {
      return redirectWithResult(returnTo, "error", "No se pudo validar el nombre de usuario.");
    }
    if (existingProfile) {
      return redirectWithResult(returnTo, "error", "Ese nombre de usuario ya está en uso.");
    }
  }

  const authEmail = usesUsername ? staffUsernameToEmail(username) : email;

  // Crear usuario en auth.users
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: usesUsername
      ? { login_type: "username", staff_username: username }
      : { login_type: "email" },
  });

  if (authError || !authUser) {
    const message = usesUsername
      ? "No se pudo crear la cuenta. Verifica que el usuario no esté registrado."
      : "No se pudo crear la cuenta. Verifica que el correo no esté registrado.";
    return redirectWithResult(returnTo, "error", message);
  }

  // Crear perfil con system_role_id
  const { error: profileError } = await adminSupabase.from("profiles").insert({
    id: authUser.user.id,
    full_name: fullName,
    role: role.name,
    system_role_id: roleId,
    username: usesUsername ? username : null,
  });

  if (profileError) {
    // Limpiar: eliminar usuario de auth si falla el perfil
    await adminSupabase.auth.admin.deleteUser(authUser.user.id);
    return redirectWithResult(returnTo, "error", `Error creando perfil: ${profileError.message}`);
  }

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    actor_role: "admin",
    action: "system_user_created",
    entity_type: "profile",
    entity_id: authUser.user.id,
    metadata: {
      full_name: fullName,
      login: usesUsername ? username : email,
      login_type: usesUsername ? "username" : "email",
      role: role.name,
    },
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/settings");
  return redirectWithResult(returnTo, "success", `Usuario ${fullName} creado exitosamente.`);
}

export async function updateUserRoleAction(formData: FormData) {
  await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const userId = String(formData.get("user_id") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!userId || !roleId) {
    return redirectWithResult(returnTo, "error", "Datos incompletos.");
  }

  // Verificar que el rol no sea admin
  const { data: role } = await adminSupabase
    .from("system_roles")
    .select("id, name, label")
    .eq("id", roleId)
    .single();

  if (!role) {
    return redirectWithResult(returnTo, "error", "Rol no válido.");
  }

  if (role.name === "admin") {
    return redirectWithResult(returnTo, "error", "No se puede asignar el rol de administrador.");
  }

  // Verificar que el usuario no sea ya admin
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .single();

  if (!profile) {
    return redirectWithResult(returnTo, "error", "Usuario no encontrado.");
  }

  if (profile.role === "admin") {
    return redirectWithResult(returnTo, "error", "No se puede cambiar el rol del administrador.");
  }

  // Actualizar perfil
  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({
      role: role.name,
      system_role_id: roleId,
    })
    .eq("id", userId);

  if (updateError) {
    return redirectWithResult(returnTo, "error", `Error actualizando rol: ${updateError.message}`);
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(returnTo, "success", `Rol de ${profile.full_name} actualizado a ${role.label}.`);
}

/** Nullable profile FKs that block auth.admin.deleteUser (profiles cascades from auth.users). */
const PROFILE_REFERENCE_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "shifts", column: "opened_by" },
  { table: "shifts", column: "closed_by" },
  { table: "payments", column: "received_by" },
  { table: "reservations", column: "created_by" },
  { table: "reservations", column: "checked_out_by" },
  { table: "cash_cuts", column: "generated_by" },
  { table: "audit_logs", column: "actor_user_id" },
  { table: "cash_movements", column: "responsible_profile_id" },
  { table: "promo_codes", column: "created_by" },
  { table: "import_batches", column: "uploaded_by" },
  { table: "folio_extra_services", column: "created_by" },
  { table: "imported_record_extra_services", column: "created_by" },
  { table: "visitor_shower_sales", column: "sold_by" },
  { table: "visitor_locker_sales", column: "sold_by" },
];

async function detachProfileReferences(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  for (const { table, column } of PROFILE_REFERENCE_COLUMNS) {
    const { error } = await adminSupabase
      .from(table)
      .update({ [column]: null })
      .eq(column, userId);
    if (error) {
      // Payments are append-only until migration 20260720140000; other tables should null fine.
      if (table === "payments" && /append-only/i.test(error.message)) {
        return "payments_append_only";
      }
      return `No se pudo liberar ${table}.${column}: ${error.message}`;
    }
  }
  return null;
}

async function softRetireStaffUser(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  fullName: string,
): Promise<string | null> {
  const { error: banError } = await adminSupabase.auth.admin.updateUserById(userId, {
    ban_duration: "876600h",
  });
  if (banError) {
    return `No se pudo bloquear el acceso: ${banError.message}`;
  }

  const retiredName = fullName.includes("(eliminado)") ? fullName : `${fullName} (eliminado)`;
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({
      is_disabled: true,
      username: null,
      full_name: retiredName,
    })
    .eq("id", userId);

  if (profileError) {
    return `No se pudo retirar el perfil: ${profileError.message}`;
  }
  return null;
}

export async function deleteUserAction(formData: FormData) {
  await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const userId = String(formData.get("user_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!userId) {
    return redirectWithResult(returnTo, "error", "Usuario no especificado.");
  }

  // Verificar que no sea admin
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .single();

  if (!profile) {
    return redirectWithResult(returnTo, "error", "Usuario no encontrado.");
  }

  if (profile.role === "admin") {
    return redirectWithResult(returnTo, "error", "No se puede eliminar al administrador.");
  }

  // Historial (turnos, pagos, auditoría, etc.) referencia al perfil sin ON DELETE;
  // hay que soltar esas FKs antes de borrar auth.users → profiles.
  const detachError = await detachProfileReferences(adminSupabase, userId);
  if (detachError && detachError !== "payments_append_only") {
    return redirectWithResult(returnTo, "error", detachError);
  }

  // Eliminar usuario (cascade elimina perfil)
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

  if (!deleteError) {
    revalidatePath("/dashboard/users");
    return redirectWithResult(returnTo, "success", `Usuario ${profile.full_name} eliminado.`);
  }

  // Si hay pagos históricos protegidos, retirar acceso sin borrar el historial contable.
  const softError = await softRetireStaffUser(adminSupabase, userId, profile.full_name);
  if (softError) {
    return redirectWithResult(
      returnTo,
      "error",
      `No se pudo eliminar (${deleteError.message}). ${softError}`,
    );
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(
    returnTo,
    "success",
    `No se pudo borrar del todo por historial de pagos; se bloqueó el acceso de ${profile.full_name} y quedó liberado el usuario.`,
  );
}

export async function toggleUserStatusAction(formData: FormData) {
  await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const userId = String(formData.get("user_id") ?? "");
  const setDisabled = formData.get("is_disabled") === "true";
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!userId) {
    return redirectWithResult(returnTo, "error", "Usuario no especificado.");
  }

  // Verificar que no sea admin
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, full_name, is_disabled")
    .eq("id", userId)
    .single();

  if (!profile) {
    return redirectWithResult(returnTo, "error", "Usuario no encontrado.");
  }

  if (profile.role === "admin") {
    return redirectWithResult(returnTo, "error", "No se puede deshabilitar al administrador.");
  }

  // Actualizar estado
  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({ is_disabled: setDisabled })
    .eq("id", userId);

  if (updateError) {
    return redirectWithResult(returnTo, "error", `Error actualizando estado: ${updateError.message}`);
  }

  // Si se deshabilita, cerrar sesiones activas del usuario
  if (setDisabled) {
    await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: "8736h" }); // ~1 año
  } else {
    await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
  }

  revalidatePath("/dashboard/users");
  const action = setDisabled ? "deshabilitado" : "habilitado";
  return redirectWithResult(returnTo, "success", `Usuario ${profile.full_name} ${action}.`);
}

export async function resetSystemUserPasswordAction(formData: FormData) {
  const actor = await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("password_confirmation") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!userId || !password || !passwordConfirmation) {
    return redirectWithResult(returnTo, "error", "Completa y confirma la nueva contraseña.");
  }
  if (password !== passwordConfirmation) {
    return redirectWithResult(returnTo, "error", "Las contraseñas no coinciden.");
  }
  if (password.length < 8 || password.length > 128) {
    return redirectWithResult(returnTo, "error", "La contraseña debe tener entre 8 y 128 caracteres.");
  }

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, full_name, username")
    .eq("id", userId)
    .single();

  if (!profile) {
    return redirectWithResult(returnTo, "error", "Usuario no encontrado.");
  }
  if (profile.role === "admin") {
    return redirectWithResult(returnTo, "error", "La contraseña del administrador no se modifica aquí.");
  }

  const { error } = await adminSupabase.auth.admin.updateUserById(userId, { password });
  if (error) {
    return redirectWithResult(returnTo, "error", "No se pudo restablecer la contraseña.");
  }

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    actor_role: "admin",
    action: "system_user_password_reset",
    entity_type: "profile",
    entity_id: userId,
    metadata: {
      full_name: profile.full_name,
      username: profile.username,
    },
  });

  revalidatePath("/dashboard/users");
  return redirectWithResult(
    returnTo,
    "success",
    `Contraseña de ${profile.full_name} restablecida.`,
  );
}

// ============================================================
// CRUD Roles y Permisos (solo admin)
// ============================================================

export async function createRoleAction(formData: FormData) {
  await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const name = String(formData.get("name") ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const label = String(formData.get("label") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!name || !label) {
    return redirectWithResult(returnTo, "error", "Nombre y etiqueta son obligatorios.");
  }

  if (name === "admin" || name === "reception" || name === "consulta") {
    return redirectWithResult(returnTo, "error", "Ese nombre de rol está reservado.");
  }

  const { error } = await adminSupabase.from("system_roles").insert({ name, label });

  if (error) {
    return redirectWithResult(returnTo, "error", `Error creando rol: ${error.message}`);
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(returnTo, "success", `Rol "${label}" creado.`);
}

export async function deleteRoleAction(formData: FormData) {
  await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const roleId = String(formData.get("role_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!roleId) {
    return redirectWithResult(returnTo, "error", "Rol no especificado.");
  }

  // Verificar que no sea un rol del sistema (admin)
  const { data: role } = await adminSupabase
    .from("system_roles")
    .select("name, is_system")
    .eq("id", roleId)
    .single();

  if (!role) {
    return redirectWithResult(returnTo, "error", "Rol no encontrado.");
  }

  if (role.is_system) {
    return redirectWithResult(returnTo, "error", "No se puede eliminar un rol del sistema.");
  }

  // Verificar que no haya usuarios con este rol
  const { count } = await adminSupabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("system_role_id", roleId);

  if (count && count > 0) {
    return redirectWithResult(returnTo, "error", `No se puede eliminar: hay ${count} usuario(s) con este rol.`);
  }

  const { error } = await adminSupabase.from("system_roles").delete().eq("id", roleId);

  if (error) {
    return redirectWithResult(returnTo, "error", `Error eliminando rol: ${error.message}`);
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(returnTo, "success", `Rol "${role.name}" eliminado.`);
}

export async function updateRolePermissionsAction(formData: FormData) {
  await requireRole(["admin"]);
  const adminSupabase = createAdminClient();
  const roleId = String(formData.get("role_id") ?? "");
  const moduleKeysRaw = String(formData.get("module_keys") ?? "[]");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!roleId) {
    return redirectWithResult(returnTo, "error", "Rol no especificado.");
  }

  let moduleKeys: string[] = [];
  try {
    moduleKeys = JSON.parse(moduleKeysRaw);
  } catch {
    return redirectWithResult(returnTo, "error", "Datos de módulos inválidos.");
  }

  // Verificar que no sea admin (admin siempre tiene todo)
  const { data: role } = await adminSupabase
    .from("system_roles")
    .select("name, is_system")
    .eq("id", roleId)
    .single();

  if (!role) {
    return redirectWithResult(returnTo, "error", "Rol no encontrado.");
  }

  if (role.is_system) {
    return redirectWithResult(returnTo, "error", "No se pueden modificar los permisos de un rol del sistema.");
  }

  // Eliminar permisos actuales
  await adminSupabase.from("role_module_permissions").delete().eq("role_id", roleId);

  // Insertar nuevos permisos
  if (moduleKeys.length > 0) {
    const { data: modules } = await adminSupabase
      .from("system_modules")
      .select("id, key")
      .in("key", moduleKeys);

    if (modules?.length) {
      const inserts = modules.map((m) => ({
        role_id: roleId,
        module_id: m.id,
      }));
      await adminSupabase.from("role_module_permissions").insert(inserts);
    }
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(returnTo, "success", "Permisos actualizados.");
}

// ============================================================
// Helpers
// ============================================================

function redirectWithResult(basePath: string, status: "success" | "error", message: string): never {
  const safeBase = basePath.startsWith("/") ? basePath : "/";
  const joiner = safeBase.includes("?") ? "&" : "?";
  redirect(`${safeBase}${joiner}status=${status}&message=${encodeURIComponent(message)}`);
}