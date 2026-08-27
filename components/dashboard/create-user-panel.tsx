"use client";

import { useState } from "react";
import { createSystemUserAction } from "@/actions/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleUsesStaffUsername } from "@/lib/auth/roles";

type RoleOption = { id: string; name: string; label: string };

type CreateUserPanelProps = {
  roles: RoleOption[];
  returnTo?: string;
};

const fieldClass =
  "w-full rounded-md border border-border-soft bg-white px-3 py-2 text-sm text-text-main";

export function CreateUserPanel({
  roles,
  returnTo = "/dashboard/users",
}: CreateUserPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const usesUsername = roleUsesStaffUsername(selectedRole?.name);

  return (
    <Card className="border-brand-primary/30 bg-brand-primary/5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-text-main">Agregar usuario</h2>
          <p className="mt-1 text-sm text-text-muted">
            {open
              ? "Crea una cuenta individual de administración, recepción u otro rol autorizado."
              : "Toca para dar de alta un nuevo usuario del sistema."}
          </p>
        </div>
        <Chevron open={open} />
      </button>

      {open ? (
        <form action={createSystemUserAction} className="mt-4 space-y-3 rounded-xl border border-border-soft bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-muted" htmlFor="new-user-name">
                Nombre completo
              </label>
              <input
                id="new-user-name"
                name="full_name"
                required
                className={fieldClass}
                placeholder="Ej. Juan Pérez"
              />
            </div>
            <div>
              {usesUsername ? (
                <>
                  <label className="mb-1 block text-sm font-medium text-text-muted" htmlFor="new-user-username">
                    Nombre de usuario
                  </label>
                  <input
                    id="new-user-username"
                    name="username"
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className={fieldClass}
                    placeholder="Ej. recepcion01"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Minúsculas, números, punto, guion o guion bajo.
                  </p>
                </>
              ) : (
                <>
                  <label className="mb-1 block text-sm font-medium text-text-muted" htmlFor="new-user-email">
                    Correo electrónico
                  </label>
                  <input
                    id="new-user-email"
                    name="email"
                    type="email"
                    required
                    className={fieldClass}
                    placeholder="correo@ejemplo.com"
                  />
                </>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-muted" htmlFor="new-user-password">
                Contraseña
              </label>
              <input
                id="new-user-password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className={fieldClass}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-muted" htmlFor="new-user-role">
                Rol
              </label>
              <select
                id="new-user-role"
                name="role_id"
                required
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
                className={cn(fieldClass, "capitalize")}
              >
                <option value="">Seleccionar rol…</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedRole?.name === "consulta" ? (
            <p className="rounded-lg border border-border-soft bg-surface-soft/60 p-3 text-sm text-text-muted">
              Este rol solo consulta operación, finanzas, turnos y auditoría. Entra con usuario y
              contraseña, igual que recepción. No puede registrar, editar ni borrar.
            </p>
          ) : null}
          {selectedRole?.name === "admin" ? (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <input
                type="checkbox"
                name="admin_confirmation"
                required
                className="mt-0.5 h-4 w-4"
              />
              Confirmo que esta persona tendrá acceso total a usuarios, pagos, cortes, auditoría y
              configuración.
            </label>
          ) : null}
          <input type="hidden" name="return_to" value={returnTo} />
          <Button type="submit" variant="primary">
            Crear usuario
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn(
        "h-5 w-5 shrink-0 text-brand-primary transition-transform",
        open ? "rotate-180" : "",
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
