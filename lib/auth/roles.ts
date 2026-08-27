/**
 * Roles de operación vs consulta.
 * `consulta` ve el panel de administración sin mutar datos.
 */
export const ROLE_ADMIN = "admin";
export const ROLE_RECEPTION = "reception";
export const ROLE_CONSULTA = "consulta";

export const CONSULTA_ROLE_LABEL = "Consulta";

/** Módulos que un socio de consulta puede ver (sin importados, ajustes, usuarios ni registrar concepto). */
export const CONSULTA_MODULE_KEYS = [
  "dashboard",
  "reservations",
  "beds",
  "guests",
  "payments",
  "expenses",
  "shifts",
  "cash_cuts",
  "reports",
  "audit",
] as const;

const CONSULTA_MODULE_KEY_SET = new Set<string>(CONSULTA_MODULE_KEYS);

export function isConsultaRole(role: string | null | undefined): boolean {
  return role === ROLE_CONSULTA;
}

/** Admin o recepción: pueden registrar, editar y borrar. */
export function isOperatorRole(role: string | null | undefined): boolean {
  return role === ROLE_ADMIN || role === ROLE_RECEPTION;
}

export function canMutate(role: string | null | undefined): boolean {
  return isOperatorRole(role);
}

/** Inicio financiero de administración (no el home de turno de recepción). */
export function seesAdminWorkspace(role: string | null | undefined): boolean {
  return role === ROLE_ADMIN || role === ROLE_CONSULTA;
}

export function isConsultaModuleKey(key: string): boolean {
  return CONSULTA_MODULE_KEY_SET.has(key);
}

/** Recepción y consulta entran con usuario, no con correo. */
export function roleUsesStaffUsername(role: string | null | undefined): boolean {
  return role === ROLE_RECEPTION || role === ROLE_CONSULTA;
}
