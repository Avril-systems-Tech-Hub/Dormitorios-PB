import type { UserRole } from "@/types/domain";
import type { SystemModule } from "@/lib/auth/permissions";

type DashboardLink = {
  href: string;
  label: string;
  roles: UserRole[];
};

// Fallback estático para cuando no hay conexión a DB o para el modo bypass
const staticDashboardLinks: DashboardLink[] = [
  { href: "/dashboard", label: "Resumen", roles: ["admin", "reception"] },
  { href: "/dashboard/reservations", label: "Reservas", roles: ["admin", "reception"] },
  { href: "/dashboard/folios", label: "Folios", roles: ["admin", "reception"] },
  { href: "/dashboard/beds", label: "Camas", roles: ["admin", "reception"] },
  { href: "/dashboard/guests", label: "Huéspedes", roles: ["admin", "reception"] },
  { href: "/dashboard/payments", label: "Pagos", roles: ["admin", "reception"] },
  { href: "/dashboard/expenses", label: "Gastos", roles: ["admin"] },
  { href: "/dashboard/imported-records", label: "Importados", roles: ["admin"] },
  { href: "/dashboard/shifts", label: "Turnos", roles: ["admin", "reception"] },
  { href: "/dashboard/cash-cuts", label: "Cortes", roles: ["admin", "reception"] },
  { href: "/dashboard/audit", label: "Auditoría", roles: ["admin"] },
  { href: "/dashboard/users", label: "Usuarios", roles: ["admin"] },
  { href: "/dashboard/settings", label: "Ajustes", roles: ["admin"] },
];

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
    roles: [] as UserRole[], // No necesario cuando viene de RBAC dinámico
  }));
}