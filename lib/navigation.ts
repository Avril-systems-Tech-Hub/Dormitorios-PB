import type { UserRole } from "@/types/domain";

type DashboardLink = {
  href: string;
  label: string;
  roles: UserRole[];
};

const dashboardLinks: DashboardLink[] = [
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
  { href: "/dashboard/settings", label: "Ajustes", roles: ["admin"] },
];

export function getDashboardLinks(role: UserRole) {
  return dashboardLinks.filter((link) => link.roles.includes(role));
}
