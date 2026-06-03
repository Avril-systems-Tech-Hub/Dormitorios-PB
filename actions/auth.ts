"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// CRUD Usuarios del sistema (solo admin)
// ============================================================

export async function createSystemUserAction(formData: FormData) {
  const adminSupabase = createAdminClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!email || !password || !fullName || !roleId) {
    return redirectWithResult(returnTo, "error", "Todos los campos son obligatorios.");
  }

  if (password.length < 6) {
    return redirectWithResult(returnTo, "error", "La contraseña debe tener al menos 6 caracteres.");
  }

  // Verificar que el rol no sea admin (solo 1 admin permitido)
  const { data: role } = await adminSupabase
    .from("system_roles")
    .select("id, name")
    .eq("id", roleId)
    .single();

  if (!role) {
    return redirectWithResult(returnTo, "error", "Rol no válido.");
  }

  if (role.name === "admin") {
    return redirectWithResult(returnTo, "error", "No se puede crear otro usuario administrador.");
  }

  // Crear usuario en auth.users
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authUser) {
    return redirectWithResult(returnTo, "error", `Error creando usuario: ${authError?.message ?? "desconocido"}`);
  }

  // Crear perfil con system_role_id
  const { error: profileError } = await adminSupabase.from("profiles").insert({
    id: authUser.user.id,
    full_name: fullName,
    role: role.name,
    system_role_id: roleId,
  });

  if (profileError) {
    // Limpiar: eliminar usuario de auth si falla el perfil
    await adminSupabase.auth.admin.deleteUser(authUser.user.id);
    return redirectWithResult(returnTo, "error", `Error creando perfil: ${profileError.message}`);
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(returnTo, "success", `Usuario ${fullName} creado exitosamente.`);
}

export async function updateUserRoleAction(formData: FormData) {
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

export async function deleteUserAction(formData: FormData) {
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

  // Eliminar usuario (cascade elimina perfil)
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

  if (deleteError) {
    return redirectWithResult(returnTo, "error", `Error eliminando usuario: ${deleteError.message}`);
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(returnTo, "success", `Usuario ${profile.full_name} eliminado.`);
}

export async function toggleUserStatusAction(formData: FormData) {
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

// ============================================================
// CRUD Roles y Permisos (solo admin)
// ============================================================

export async function createRoleAction(formData: FormData) {
  const adminSupabase = createAdminClient();
  const name = String(formData.get("name") ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const label = String(formData.get("label") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "/dashboard/users");

  if (!name || !label) {
    return redirectWithResult(returnTo, "error", "Nombre y etiqueta son obligatorios.");
  }

  if (name === "admin") {
    return redirectWithResult(returnTo, "error", "No se puede crear un rol llamado 'admin'.");
  }

  const { error } = await adminSupabase.from("system_roles").insert({ name, label });

  if (error) {
    return redirectWithResult(returnTo, "error", `Error creando rol: ${error.message}`);
  }

  revalidatePath("/dashboard/users");
  return redirectWithResult(returnTo, "success", `Rol "${label}" creado.`);
}

export async function deleteRoleAction(formData: FormData) {
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
    return redirectWithResult(returnTo, "error", "No se pueden modificar los permisos del administrador.");
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