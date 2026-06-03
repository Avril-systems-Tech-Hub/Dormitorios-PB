"use client";

import { useState } from "react";
import {
  createRoleAction,
  deleteRoleAction,
  updateRolePermissionsAction,
} from "@/actions/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  allModules: SystemModule[];
  roleModulesMap: Map<string, string[]>;
  allRoles: SystemRole[];
};

const fieldClass =
  "rounded-md border border-border-soft bg-white px-3 py-2 text-sm text-text-main";

export function UsersPanel({
  profiles,
  allModules,
  roleModulesMap,
  allRoles,
}: UsersPanelProps) {
  const [tab, setTab] = useState<"roles" | "edit-role">("roles");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

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
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-main">Roles y permisos</h3>
            <p className="mt-0.5 text-sm text-text-muted">
              Define qué módulos del panel puede ver cada rol (camas, pagos, cortes, etc.).
            </p>
          </div>
          <div
            className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
            role="group"
            aria-label="Sección de roles"
          >
            <button
              type="button"
              onClick={() => setTab("roles")}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition",
                tab === "roles"
                  ? "bg-white text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main",
              )}
            >
              Lista de roles
            </button>
            {tab === "edit-role" ? (
              <button
                type="button"
                className="rounded-md bg-brand-primary/10 px-3 py-1.5 font-medium text-brand-primary shadow-sm"
              >
                Editando permisos
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {tab === "roles" && (
        <div className="space-y-4">
          <Card>
            <h4 className="text-sm font-semibold text-text-main">Crear nuevo rol</h4>
            <form action={createRoleAction} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted" htmlFor="role-name">
                  Nombre interno
                </label>
                <input
                  id="role-name"
                  name="name"
                  required
                  className={fieldClass}
                  placeholder="ej: cajero"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted" htmlFor="role-label">
                  Nombre visible
                </label>
                <input
                  id="role-label"
                  name="label"
                  required
                  className={fieldClass}
                  placeholder="ej: Cajero"
                />
              </div>
              <input type="hidden" name="return_to" value="/dashboard/users" />
              <Button type="submit" variant="primary">
                Crear rol
              </Button>
            </form>
          </Card>

          <Card>
            <h4 className="text-sm font-semibold text-text-main">Roles del sistema</h4>
            <ul className="mt-3 space-y-3">
              {allRoles.map((r) => {
                const modules = roleModulesMap.get(r.id) ?? [];
                const usersWithRole = profiles.filter((p) => p.system_role_id === r.id).length;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface-soft/30 p-3"
                  >
                    <div>
                      <span className="font-medium text-text-main">{r.label}</span>
                      {r.is_system ? (
                        <span className="ml-2 rounded-full bg-surface-soft px-2 py-0.5 text-xs text-text-muted">
                          Sistema
                        </span>
                      ) : null}
                      <p className="mt-0.5 text-xs text-text-muted">
                        {modules.length} módulo{modules.length !== 1 ? "s" : ""} · {usersWithRole}{" "}
                        usuario{usersWithRole !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {!r.is_system ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => startEditRole(r.id)}
                        >
                          Editar permisos
                        </Button>
                        <form
                          action={deleteRoleAction}
                          onSubmit={(event) => {
                            if (!confirm(`¿Eliminar el rol "${r.label}"?`)) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="role_id" value={r.id} />
                          <input type="hidden" name="return_to" value="/dashboard/users" />
                          <Button type="submit" variant="danger" className="h-8 px-3 text-xs">
                            Eliminar rol
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {tab === "edit-role" && editingRoleId ? (
        <Card>
          <h4 className="text-sm font-semibold text-text-main">
            Permisos: {allRoles.find((r) => r.id === editingRoleId)?.label ?? "Rol"}
          </h4>
          <form
            className="mt-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              formData.set("module_keys", JSON.stringify(selectedModules));
              await updateRolePermissionsAction(formData);
            }}
          >
            <input type="hidden" name="role_id" value={editingRoleId} />
            <input type="hidden" name="return_to" value="/dashboard/users" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allModules.map((mod) => (
                <label
                  key={mod.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition",
                    selectedModules.includes(mod.key)
                      ? "border-brand-primary/40 bg-brand-primary/5"
                      : "border-border-soft hover:bg-surface-soft/50",
                  )}
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" variant="primary">
                Guardar permisos
              </Button>
              <Button type="button" variant="outline" onClick={() => setTab("roles")}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
