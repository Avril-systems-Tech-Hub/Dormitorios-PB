import type { UserRole } from "@/types/domain";
import type { SystemModule } from "@/lib/auth/permissions";
import { isConsultaModuleKey, isConsultaRole } from "@/lib/auth/roles";

type DashboardLink = {
  href: string;
  label: string;
  roles: UserRole[];
};

export type NavItem = {
  key: string;
  href: string;
  label: string;
  sort_order: number;
};

export type NavGroup = {
  label: string;
  items: { href: string; label: string }[];
};

const HREF_TO_KEY: Record<string, string> = {
  "/dashboard": "dashboard",
  "/dashboard/register-stay": "register_stay",
  "/dashboard/reservations": "reservations",
  "/dashboard/beds": "beds",
  "/dashboard/guests": "guests",
  "/dashboard/payments": "payments",
  "/dashboard/expenses": "expenses",
  "/dashboard/imported-records": "imported_records",
  "/dashboard/shifts": "shifts",
  "/dashboard/cash-cuts": "cash_cuts",
  "/dashboard/reports": "reports",
  "/dashboard/audit": "audit",
  "/dashboard/users": "users",
  "/dashboard/settings": "settings",
};

/** Modules kept for permissions/URLs but omitted from sidebar navigation. */
export const HIDDEN_NAV_MODULE_KEYS = new Set(["folios", "users"]);

/** Frontend display labels (RBAC module keys stay unchanged). */
const NAV_LABEL_OVERRIDES: Record<string, string> = {
  dashboard: "Inicio",
  register_stay: "Registrar concepto",
  payments: "Ingresos",
  expenses: "Egresos",
};

function navLabel(key: string, label: string): string {
  return NAV_LABEL_OVERRIDES[key] ?? label;
}

export const NAV_GROUP_DEFS: { label: string; keys: string[] }[] = [
  {
    label: "Operación",
    keys: ["dashboard", "register_stay", "reservations", "beds", "guests"],
  },
  {
    label: "Finanzas",
    keys: ["payments", "expenses", "cash_cuts", "reports"],
  },
  {
    label: "Administración",
    keys: ["imported_records", "shifts", "audit", "users", "settings"],
  },
];

/** Recepción: operación, mapa de camas, huéspedes y egresos del turno. */
export const RECEPTION_NAV_GROUP_DEFS: { label: string; keys: string[] }[] = [
  {
    label: "Operación",
    keys: ["dashboard", "register_stay", "beds", "guests", "expenses"],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Inicio",
  "/dashboard/register-stay": "Registrar concepto",
  "/dashboard/reservations": "Reservas",
  "/dashboard/folios": "Folios",
  "/dashboard/beds": "Camas",
  "/dashboard/guests": "Huéspedes",
  "/dashboard/payments": "Ingresos",
  "/dashboard/expenses": "Egresos",
  "/dashboard/imported-records": "Importados",
  "/dashboard/shifts": "Turnos",
  "/dashboard/cash-cuts": "Cortes",
  "/dashboard/reports": "Reportes",
  "/dashboard/audit": "Auditoría",
  "/dashboard/users": "Usuarios",
  "/dashboard/settings": "Ajustes",
};

// Fallback estático para cuando no hay conexión a DB o para el modo bypass
const staticDashboardLinks: DashboardLink[] = [
  { href: "/dashboard", label: "Resumen", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/register-stay", label: "Registrar concepto", roles: ["admin", "reception"] },
  { href: "/dashboard/reservations", label: "Reservas", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/beds", label: "Camas", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/guests", label: "Huéspedes", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/payments", label: "Ingresos", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/expenses", label: "Egresos", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/imported-records", label: "Importados", roles: ["admin"] },
  { href: "/dashboard/shifts", label: "Turnos", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/cash-cuts", label: "Cortes", roles: ["admin", "reception", "consulta"] },
  { href: "/dashboard/reports", label: "Reportes", roles: ["admin", "consulta"] },
  { href: "/dashboard/audit", label: "Auditoría", roles: ["admin", "consulta"] },
  { href: "/dashboard/users", label: "Usuarios", roles: ["admin"] },
  { href: "/dashboard/settings", label: "Ajustes", roles: ["admin"] },
];

const STATIC_SORT_ORDER: Record<string, number> = {
  dashboard: 1,
  register_stay: 2,
  reservations: 3,
  folios: 4,
  beds: 5,
  guests: 6,
  payments: 7,
  expenses: 8,
  imported_records: 9,
  shifts: 10,
  cash_cuts: 11,
  reports: 12,
  audit: 13,
  users: 14,
  settings: 15,
};

/**
 * Obtiene los links del dashboard filtrados por rol (fallback estático).
 */
export function getDashboardLinks(role: UserRole): DashboardLink[] {
  return staticDashboardLinks.filter((link) => link.roles.includes(role));
}

/**
 * Convierte módulos dinámicos del RBAC al formato DashboardLink.
 * Se usa en el dashboard layout para renderizar el sidebar según permisos reales.
 */
export function modulesToDashboardLinks(modules: SystemModule[]): DashboardLink[] {
  return modules.map((m) => ({
    href: m.href,
    label: m.label,
    roles: [] as UserRole[],
  }));
}

export function modulesToNavItems(modules: SystemModule[]): NavItem[] {
  return modules
    .filter((m) => !HIDDEN_NAV_MODULE_KEYS.has(m.key))
    .map((m) => ({
      key: m.key,
      href: m.href,
      label: navLabel(m.key, m.label),
      sort_order: m.sort_order,
    }));
}

export function linksToNavItems(links: DashboardLink[]): NavItem[] {
  return links
    .map((link) => {
      const key = HREF_TO_KEY[link.href] ?? link.href;
      return {
        key,
        href: link.href,
        label: navLabel(key, link.label),
        sort_order: STATIC_SORT_ORDER[key] ?? 999,
      };
    })
    .filter((item) => !HIDDEN_NAV_MODULE_KEYS.has(item.key));
}

export function groupNavItems(
  items: NavItem[],
  groupDefs: { label: string; keys: string[] }[] = NAV_GROUP_DEFS,
): NavGroup[] {
  const assigned = new Set<string>();
  const groups: NavGroup[] = [];

  for (const def of groupDefs) {
    const groupItems = items
      .filter((item) => def.keys.includes(item.key))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ href, label }) => ({ href, label }));

    for (const item of groupItems) {
      const key = HREF_TO_KEY[item.href];
      if (key) assigned.add(key);
    }

    if (groupItems.length > 0) {
      groups.push({ label: def.label, items: groupItems });
    }
  }

  const unmapped = items
    .filter((item) => !assigned.has(item.key))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ href, label }) => ({ href, label }));

  if (unmapped.length > 0) {
    const operationsGroup = groups.find((g) => g.label === "Operación");
    if (operationsGroup) {
      operationsGroup.items.push(...unmapped);
    } else {
      groups.unshift({ label: "Operación", items: unmapped });
    }
  }

  return groups;
}

export function groupModules(modules: SystemModule[], role?: UserRole): NavGroup[] {
  const groupDefs = role === "reception" ? RECEPTION_NAV_GROUP_DEFS : NAV_GROUP_DEFS;
  let items = modulesToNavItems(modules);
  if (role === "reception") {
    items = items.filter(
      (item) =>
        item.key === "dashboard" ||
        item.key === "register_stay" ||
        item.key === "beds" ||
        item.key === "guests" ||
        item.key === "expenses",
    );
  } else if (isConsultaRole(role)) {
    items = items.filter((item) => isConsultaModuleKey(item.key));
  }
  return groupNavItems(items, groupDefs);
}

export function groupDashboardLinks(role: UserRole): NavGroup[] {
  const groupDefs = role === "reception" ? RECEPTION_NAV_GROUP_DEFS : NAV_GROUP_DEFS;
  let items = linksToNavItems(getDashboardLinks(role));
  if (role === "reception") {
    items = items.filter(
      (item) =>
        item.key === "dashboard" ||
        item.key === "register_stay" ||
        item.key === "beds" ||
        item.key === "guests" ||
        item.key === "expenses",
    );
  }
  return groupNavItems(items, groupDefs);
}

export function getPageTitle(pathname: string, fallback = "Panel operativo"): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  const sortedHrefs = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const href of sortedHrefs) {
    if (href !== "/dashboard" && pathname.startsWith(`${href}/`)) {
      return PAGE_TITLES[href];
    }
  }

  return fallback;
}
