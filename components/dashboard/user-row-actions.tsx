"use client";

import {
  deleteUserAction,
  resetSystemUserPasswordAction,
  toggleUserStatusAction,
  updateUserRoleAction,
} from "@/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export function UserRowActions({
  userId,
  fullName,
  systemRoleId,
  isDisabled,
  isAdmin,
  isCurrentUser,
  roles,
}: UserRowActionsProps) {
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
          <form
            action={deleteUserAction}
            onSubmit={(event) => {
              if (
                !confirm(
                  `¿Eliminar a ${fullName}? Se borrará su cuenta y ya no podrá iniciar sesión.`,
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="user_id" value={userId} />
            <input type="hidden" name="return_to" value="/dashboard/users" />
            <Button type="submit" variant="danger" className="h-8 px-3 text-xs">
              Eliminar
            </Button>
          </form>
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
          <label className="block text-xs text-text-muted" htmlFor={`password-${userId}`}>
            Nueva contraseña
          </label>
          <input
            id={`password-${userId}`}
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            className={cn(fieldClass, "w-full")}
          />
          <label className="block text-xs text-text-muted" htmlFor={`password-confirmation-${userId}`}>
            Confirmar contraseña
          </label>
          <input
            id={`password-confirmation-${userId}`}
            name="password_confirmation"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            className={cn(fieldClass, "w-full")}
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
