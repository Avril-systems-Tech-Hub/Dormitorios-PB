import { formatMexicoCityDate, formatMexicoCityDateTime, MEXICO_CITY_TZ } from "@/lib/dates";
import { type TableColumnConfig } from "@/lib/table-controls";

const CDMX = MEXICO_CITY_TZ;

/** Day of month from check-in date (legacy "Día" column). */
export function formatRosterDay(checkInDate: string): string {
  const parts = checkInDate.split("-");
  const day = Number(parts[2]);
  return Number.isFinite(day) ? String(day) : "—";
}

export function formatRosterDate(dateString: string): string {
  return formatMexicoCityDate(dateString, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatRosterTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("es-MX", {
    timeZone: CDMX,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRosterDateTime(isoTimestamp: string): string {
  return formatMexicoCityDateTime(isoTimestamp, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function computeGuestLineTotal(
  nights: number,
  finalRate: number,
  lockerAmount: number,
): number {
  return Number((finalRate * Math.max(0, nights) + lockerAmount).toFixed(2));
}

export const GUEST_ROSTER_COLUMNS: TableColumnConfig[] = [
  { key: "dia", label: "Día", sortable: true },
  { key: "nombre", label: "Nombre", sortable: true },
  { key: "folio", label: "Folio", sortable: true },
  { key: "sexo", label: "Sexo", sortable: true },
  { key: "cama", label: "No. Cama", sortable: true },
  { key: "locker", label: "No. Locker", sortable: true },
  { key: "ingreso", label: "Fecha ingreso", sortable: true },
  { key: "hora", label: "Hora", sortable: true },
  { key: "salida", label: "Fecha salida", sortable: true },
  { key: "noches", label: "Noches", sortable: true },
  { key: "total", label: "Total", sortable: true },
  { key: "pago", label: "Pago", sortable: true },
  { key: "nota", label: "Nota de reservación", sortable: true },
  { key: "estado", label: "Estado / salida", sortable: true },
  { key: "editar", label: "Editar" },
];

export const GUEST_ROSTER_SORT_KEYS = GUEST_ROSTER_COLUMNS.filter((column) => column.sortable).map(
  (column) => column.key,
);

export const ADMIN_GUESTS_COLUMNS: TableColumnConfig[] = [
  { key: "huesped", label: "Huésped", sortable: true },
  { key: "telefono", label: "Teléfono", sortable: true },
  { key: "folio", label: "Folio", sortable: true },
  { key: "pago", label: "Pago", sortable: true },
  { key: "resumen", label: "Resumen", sortable: true },
  { key: "visita", label: "Última visita", sortable: true },
  { key: "alta", label: "Alta", sortable: true },
  { key: "eliminar", label: "" },
];

export const ADMIN_GUESTS_SORT_KEYS = ADMIN_GUESTS_COLUMNS.filter((column) => column.sortable).map(
  (column) => column.key,
);
