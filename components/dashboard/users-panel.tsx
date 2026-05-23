"use client";

import { useState } from "react";
import type { SystemModule, SystemRole } from "@/lib/auth/permissions";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  system_role_id: string | null;
  is_disabled: boolean;
  created_at: string;
};

type UsersPanelProps = {
  profiles: Profile[];
  roles: SystemRole[];
  allModules: SystemModule[];
  roleModulesMap: Map<string, string[]>;
  allRoles: SystemRole[];
  currentUserId: string;
};

export function UsersPanel({
  profiles,
  roles,
  allModules,
  roleModulesMap,
  allRoles,
  currentUserId,
}: UsersPanelProps) {
  const [tab, setTab] = useState<"create-user" | "roles" | "edit-role">("create-user");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Usuarios no admin
  const nonAdminProfiles = profiles.filter((p) => p.role !== "admin");

  const startEditRole = (roleId: string) => {
    setEditingRoleId(roleId);
    setSelectedModules(roleModulesMap.get(roleId) ?? []);
    setTab("edit-role");
  };

  const toggleModule = (key: string) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b-2 border-[#1f4e5f] pb-0">
        <button
          type="button"
          onClick={() => setTab("create-user")}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
            tab === "create-user"
              ? "bg-[#1f4e5f] text-white shadow-sm"
              : "bg-[#e8ecef] text-[#17212b] hover:bg-[#d0d6db]"
          }`}
        >
          Nuevo Usuario
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
            tab === "roles" || tab === "edit-role"
              ? "bg-[#1f4e5f] text-white shadow-sm"
              : "bg-[#e8ecef] text-[#17212b] hover:bg-[#d0d6db]"
          }`}
        >
          Roles y Permisos
        </button>
        {tab === "edit-role" && (
          <button
            type="button"
            className="px-5 py-2.5 text-sm font-semibold rounded-t-lg bg-[#f2a65a] text-white shadow-sm transition-colors"
          >
            ✏️ Editar Permisos
          </button>
        )}
      </div>

      {/* Tab: Crear usuario */}
      {tab === "create-user" && (
        <Card>
          <h3 className="text-md font-semibold text-text-main mb-4">Crear nuevo usuario</h3>
          <form action="/api/auth/users/create" method="POST" className="space-y-3 max-w-md" onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            // Use server action via form submission trick
            import("@/actions/auth").then(({ createSystemUserAction }) => {
              createSystemUserAction(formData);
            });
          }}>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Nombre completo</label>
              <input
                name="full_name"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Correo electrónico</label>
              <input
                name="email"
                type="email"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Contraseña</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Rol</label>
              <select
                name="role_id"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Seleccionar rol...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <input type="hidden" name="return_to" value="/dashboard/users" />
            <button
              type="submit"
              className="bg-[#1f4e5f] text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-[#2b6b7f] transition-colors"
            >
              ＋ Crear Usuario
            </button>
          </form>
        </Card>
      )}

      {/* Tab: Cambiar rol de usuario */}
      {tab === "create-user" && nonAdminProfiles.length > 0 && (
        <Card>
          <h3 className="text-md font-semibold text-text-main mb-4">Cambiar rol de usuario</h3>
          <div className="space-y-3">
            {nonAdminProfiles.map((p) => (
              <form
                key={p.id}
                className="flex items-center gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  import("@/actions/auth").then(({ updateUserRoleAction }) => {
                    updateUserRoleAction(formData);
                  });
                }}
              >
                <span className="text-sm text-text-main w-48 truncate">{p.full_name}</span>
                <input type="hidden" name="user_id" value={p.id} />
                <input type="hidden" name="return_to" value="/dashboard/users" />
                <select
                  name="role_id"
                  defaultValue={p.system_role_id ?? ""}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="bg-[#1f4e5f] text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-[#2b6b7f] transition-colors"
                >
                  Guardar
                </button>
                {p.id !== currentUserId && (
                  <>
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        p.is_disabled
                          ? "bg-[#1f8f4e] text-white hover:bg-[#167a3e]"
                          : "bg-[#d08a00] text-white hover:bg-[#b57500]"
                      }`}
                      onClick={() => {
                        const action = p.is_disabled ? "habilitar" : "deshabilitar";
                        if (confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} a ${p.full_name}?`)) {
                          const formData = new FormData();
                          formData.set("user_id", p.id);
                          formData.set("is_disabled", p.is_disabled ? "false" : "true");
                          formData.set("return_to", "/dashboard/users");
                          import("@/actions/auth").then(({ toggleUserStatusAction }) => {
                            toggleUserStatusAction(formData);
                          });
                        }
                      }}
                    >
                      {p.is_disabled ? "✅ Habilitar" : "⛔ Deshabilitar"}
                    </button>
                  </>
                )}
              </form>
            ))}
          </div>
        </Card>
      )}

      {/* Tab: Roles y Permisos */}
      {tab === "roles" && (
        <div className="space-y-4">
          {/* Crear nuevo rol */}
          <Card>
            <h3 className="text-md font-semibold text-text-main mb-4">Crear nuevo rol</h3>
            <form
              className="flex items-end gap-3 max-w-lg"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                import("@/actions/auth").then(({ createRoleAction }) => {
                  createRoleAction(formData);
                });
              }}
            >
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Nombre (interno)</label>
                <input
                  name="name"
                  required
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="ej: cajero"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Etiqueta (visible)</label>
                <input
                  name="label"
                  required
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="ej: Cajero"
                />
              </div>
              <input type="hidden" name="return_to" value="/dashboard/users" />
              <button
                type="submit"
                className="bg-[#1f4e5f] text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-[#2b6b7f] transition-colors"
              >
                ＋ Crear Rol
              </button>
            </form>
          </Card>

          {/* Lista de roles */}
          <Card>
            <h3 className="text-md font-semibold text-text-main mb-4">Roles del sistema</h3>
            <div className="space-y-3">
              {allRoles.map((r) => {
                const modules = roleModulesMap.get(r.id) ?? [];
                const usersWithRole = profiles.filter((p) => p.system_role_id === r.id).length;
                return (
                  <div
                    key={r.id}
                    className="border border-gray-200 rounded p-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-text-main">{r.label}</span>
                      {r.is_system && (
                        <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          Sistema
                        </span>
                      )}
                      <span className="ml-2 text-xs text-text-muted">
                        {modules.length} módulo{modules.length !== 1 ? "s" : ""} · {usersWithRole} usuario{usersWithRole !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {!r.is_system && (
                        <>
                          <button
                            type="button"
                            className="bg-[#2b6b7f] text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-[#1f4e5f] transition-colors"
                            onClick={() => startEditRole(r.id)}
                          >
                            Editar Permisos
                          </button>
                          <button
                            type="button"
                            className="bg-[#c53b3b] text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-[#a52e2e] transition-colors"
                            onClick={() => {
                              if (confirm(`¿Eliminar el rol "${r.label}"?`)) {
                                const formData = new FormData();
                                formData.set("role_id", r.id);
                                formData.set("return_to", "/dashboard/users");
                                import("@/actions/auth").then(({ deleteRoleAction }) => {
                                  deleteRoleAction(formData);
                                });
                              }
                            }}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Editar permisos de un rol */}
      {tab === "edit-role" && editingRoleId && (
        <Card>
          <h3 className="text-md font-semibold text-text-main mb-4">
            Editar permisos: {allRoles.find((r) => r.id === editingRoleId)?.label ?? "Rol"}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData();
              formData.set("role_id", editingRoleId);
              formData.set("module_keys", JSON.stringify(selectedModules));
              formData.set("return_to", "/dashboard/users");
              import("@/actions/auth").then(({ updateRolePermissionsAction }) => {
                updateRolePermissionsAction(formData);
              });
            }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {allModules.map((mod) => (
                <label
                  key={mod.key}
                  className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-sm ${
                    selectedModules.includes(mod.key)
                      ? "border-primary bg-primary/5"
                      : "border-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(mod.key)}
                    onChange={() => toggleModule(mod.key)}
                    className="rounded"
                  />
                  <span>{mod.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-[#1f4e5f] text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-[#2b6b7f] transition-colors"
              >
                Guardar Permisos
              </button>
              <button
                type="button"
                onClick={() => setTab("roles")}
                className="bg-[#e8ecef] text-[#17212b] px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d0d6db] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-xl border border-gray-200 p-4 ${className}`}>
      {children}
    </div>
  );
}