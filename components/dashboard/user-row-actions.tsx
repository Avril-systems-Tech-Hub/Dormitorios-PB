"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteUserAction,
  resetSystemUserPasswordAction,
  toggleUserStatusAction,
  updateUserRoleAction,
} from "@/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, isNextRedirect } from "@/lib/utils";

type RoleOption = { id: string; label: string };

type UserRowActionsProps = {
  userId: string;
  fullName: string;
  systemRoleId: string | null;
  isDisabled: boolean;
  isAdmin: boolean;
  isCurrentUser: boolean;
  roles: RoleOption[];
};

const fieldClass =
  "rounded-md border border-border-soft bg-white px-2 py-1.5 text-sm text-text-main";

export function UserStatusBadge({ isAdmin, isDisabled }: { isAdmin: boolean; isDisabled: boolean }) {
  if (isAdmin) {
    return <Badge variant="default">Administrador</Badge>;
  }
  if (isDisabled) {
    return <Badge variant="warning">Acceso desactivado</Badge>;
  }
  return <Badge variant="success">Activo</Badge>;
}

export function UserCredentialsCell({
  fullName,
  loginLabel,
  loginKind,
}: {
  fullName: string;
  loginLabel: string;
  loginKind: "username" | "email";
}) {
  const [showPasswordHint, setShowPasswordHint] = useState(false);

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="font-medium text-text-main">{fullName}</p>
      <p className="text-xs text-text-muted">
        {loginKind === "username" ? "Usuario de acceso" : "Correo de acceso"}:{" "}
        <span className="font-medium text-text-main">{loginLabel}</span>
      </p>
      {loginKind === "username" ? (
        <p className="text-[11px] text-text-muted">
          En el login escribe solo <span className="font-medium text-text-main">{loginLabel}</span>, sin @.
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Contraseña:</span>
        <span className="font-mono text-xs tracking-widest text-text-main">••••••••</span>
        <button
          type="button"
          className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-main"
          aria-label={showPasswordHint ? "Ocultar aviso de contraseña" : "Ver aviso de contraseña"}
          title="La contraseña guardada no se puede recuperar"
          onClick={() => setShowPasswordHint((prev) => !prev)}
        >
          <EyeIcon open={showPasswordHint} />
        </button>
      </div>
      {showPasswordHint ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          Por seguridad la contraseña no se puede ver después de guardarla. Usa “Restablecer
          contraseña” y el ojito al escribir la nueva para confirmarla antes de compartirla.
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <path d="M1 1l22 22" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordField({
  id,
  name,
  label,
}: {
  id: string;
  name: string;
  label: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block text-xs text-text-muted" htmlFor={id}>
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className={cn(fieldClass, "w-full")}
        />
        <button
          type="button"
          className="rounded p-1.5 text-text-muted hover:bg-white hover:text-text-main"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setVisible((prev) => !prev)}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </div>
  );
}

export function UserRowActions({
  userId,
  fullName,
  systemRoleId,
  isDisabled,
  isAdmin,
  isCurrentUser,
  roles,
}: UserRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (isAdmin) {
    return (
      <p className="text-xs text-text-muted">La cuenta de administrador no se puede modificar aquí.</p>
    );
  }

  return (
    <div className="flex min-w-[14rem] flex-col gap-2">
      <form action={updateUserRoleAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="return_to" value="/dashboard/users" />
        <label className="sr-only" htmlFor={`role-${userId}`}>
          Rol de {fullName}
        </label>
        <select
          id={`role-${userId}`}
          name="role_id"
          defaultValue={systemRoleId ?? ""}
          required
          className={cn(fieldClass, "min-w-[8rem] flex-1")}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-8 px-3 text-xs">
          Guardar rol
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <form action={toggleUserStatusAction}>
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="is_disabled" value={isDisabled ? "false" : "true"} />
          <input type="hidden" name="return_to" value="/dashboard/users" />
          <Button
            type="submit"
            variant={isDisabled ? "primary" : "secondary"}
            className="h-8 px-3 text-xs"
            disabled={isCurrentUser}
            title={isCurrentUser ? "No puedes desactivar tu propia cuenta" : undefined}
          >
            {isDisabled ? "Activar acceso" : "Desactivar acceso"}
          </Button>
        </form>

        {!isCurrentUser ? (
          <Button
            type="button"
            variant="danger"
            className="h-8 px-3 text-xs"
            disabled={isPending}
            onClick={() => {
              if (
                !confirm(
                  `¿Eliminar a ${fullName}? Se borrará su cuenta y ya no podrá iniciar sesión.`,
                )
              ) {
                return;
              }
              startTransition(async () => {
                try {
                  const formData = new FormData();
                  formData.set("user_id", userId);
                  formData.set("return_to", "/dashboard/users");
                  await deleteUserAction(formData);
                } catch (error) {
                  if (isNextRedirect(error)) throw error;
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "No se pudo eliminar el usuario. Intenta de nuevo.",
                  );
                }
              });
            }}
          >
            {isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        ) : null}
      </div>

      <details className="rounded-md border border-border-soft bg-surface-soft/40 p-2">
        <summary className="cursor-pointer text-xs font-medium text-text-main">
          Restablecer contraseña
        </summary>
        <form
          action={resetSystemUserPasswordAction}
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            if (!confirm(`¿Establecer una nueva contraseña para ${fullName}?`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="return_to" value="/dashboard/users" />
          <PasswordField id={`password-${userId}`} name="password" label="Nueva contraseña" />
          <PasswordField
            id={`password-confirmation-${userId}`}
            name="password_confirmation"
            label="Confirmar contraseña"
          />
          <Button type="submit" variant="outline" className="h-8 px-3 text-xs">
            Guardar nueva contraseña
          </Button>
        </form>
      </details>

      {isCurrentUser ? (
        <p className="text-xs text-text-muted">Eres tú: no puedes desactivar ni eliminar tu cuenta.</p>
      ) : null}
    </div>
  );
}
