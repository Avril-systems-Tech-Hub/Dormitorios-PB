import type { UserRole } from "@/types/domain";
import type { SystemModule } from "@/lib/auth/permissions";

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
  "/dashboard/reservations": "reservations",
  "/dashboard/beds": "beds",
  "/dashboard/guests": "guests",
  "/dashboard/payments": "payments",
  "/dashboard/expenses": "expenses",
  "/dashboard/imported-records": "imported_records",
  "/dashboard/shifts": "shifts",
  "/dashboard/cash-cuts": "cash_cuts",
  "/dashboard/audit": "audit",
  "/dashboard/users": "users",
  "/dashboard/settings": "settings",
};

/** Modules kept for permissions/URLs but omitted from sidebar navigation. */
export const HIDDEN_NAV_MODULE_KEYS = new Set(["folios", "users"]);

/** Frontend display labels (RBAC module keys stay unchanged). */
const NAV_LABEL_OVERRIDES: Record<string, string> = {
  dashboard: "Recepción",
  payments: "Ingresos",
  expenses: "Egresos",
};

function navLabel(key: string, label: string): string {
  return NAV_LABEL_OVERRIDES[key] ?? label;
}

export const NAV_GROUP_DEFS: { label: string; keys: string[] }[] = [
  {
    label: "Operación",
    keys: ["dashboard", "reservations", "beds", "guests"],
  },
  {
    label: "Finanzas",
    keys: ["payments", "expenses", "cash_cuts"],
  },
  {
    label: "Administración",
    keys: ["imported_records", "shifts", "audit", "users", "settings"],
  },
];

/** Recepción: operación, mapa de camas y listado de huéspedes. */
export const RECEPTION_NAV_GROUP_DEFS: { label: string; keys: string[] }[] = [
  {
    label: "Operación",
    keys: ["dashboard", "beds", "guests"],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Recepción",
  "/dashboard/reservations": "Reservas",
  "/dashboard/folios": "Folios",
  "/dashboard/beds": "Camas",
  "/dashboard/guests": "Huéspedes",
  "/dashboard/payments": "Ingresos",
  "/dashboard/expenses": "Egresos",
  "/dashboard/imported-records": "Importados",
  "/dashboard/shifts": "Turnos",
  "/dashboard/cash-cuts": "Cortes",
  "/dashboard/audit": "Auditoría",
  "/dashboard/users": "Usuarios",
  "/dashboard/settings": "Ajustes",
};

// Fallback estático para cuando no hay conexión a DB o para el modo bypass
const staticDashboardLinks: DashboardLink[] = [
  { href: "/dashboard", label: "Resumen", roles: ["admin", "reception"] },
  { href: "/dashboard/reservations", label: "Reservas", roles: ["admin", "reception"] },
  { href: "/dashboard/beds", label: "Camas", roles: ["admin", "reception"] },
  { href: "/dashboard/guests", label: "Huéspedes", roles: ["admin"] },
  { href: "/dashboard/payments", label: "Ingresos", roles: ["admin", "reception"] },
  { href: "/dashboard/expenses", label: "Egresos", roles: ["admin", "reception"] },
  { href: "/dashboard/imported-records", label: "Importados", roles: ["admin"] },
  { href: "/dashboard/shifts", label: "Turnos", roles: ["admin", "reception"] },
  { href: "/dashboard/cash-cuts", label: "Cortes", roles: ["admin", "reception"] },
  { href: "/dashboard/audit", label: "Auditoría", roles: ["admin"] },
  { href: "/dashboard/users", label: "Usuarios", roles: ["admin"] },
  { href: "/dashboard/settings", label: "Ajustes", roles: ["admin"] },
];

const STATIC_SORT_ORDER: Record<string, number> = {
  dashboard: 1,
  reservations: 2,
  folios: 3,
  beds: 4,
  guests: 5,
  payments: 6,
  expenses: 7,
  imported_records: 8,
  shifts: 9,
  cash_cuts: 10,
  audit: 11,
  users: 12,
  settings: 13,
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
      (item) => item.key === "dashboard" || item.key === "beds" || item.key === "guests",
    );
  }
  return groupNavItems(items, groupDefs);
}

export function groupDashboardLinks(role: UserRole): NavGroup[] {
  const groupDefs = role === "reception" ? RECEPTION_NAV_GROUP_DEFS : NAV_GROUP_DEFS;
  let items = linksToNavItems(getDashboardLinks(role));
  if (role === "reception") {
    items = items.filter(
      (item) => item.key === "dashboard" || item.key === "beds" || item.key === "guests",
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
