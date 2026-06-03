import { buildBedOccupancyMap, type BedOccupancyDetail } from "@/lib/bed-occupancy";

export type BedSummaryFilter = "inventario" | "libres";

export type BedSummaryCounts = Record<BedSummaryFilter, number>;

export const BED_SUMMARY_FILTERS: {
  value: BedSummaryFilter;
  toggleLabel: string;
  title: string;
  badge?: string;
  badgeVariant?: "success" | "warning";
  hint?: string;
}[] = [
  {
    value: "inventario",
    toggleLabel: "Inventario",
    title: "Camas en inventario",
    badge: "Sin bloqueo",
    badgeVariant: "success",
    hint: "Camas operativas (excluye bloqueadas)",
  },
  {
    value: "libres",
    toggleLabel: "Libres hoy",
    title: "Camas libres hoy",
    hint: "Inventario menos ocupadas hoy",
  },
];

export function getBedSummaryMeta(filter: BedSummaryFilter) {
  return BED_SUMMARY_FILTERS.find((f) => f.value === filter) ?? BED_SUMMARY_FILTERS[0];
}

export function parseBedSummaryFilter(raw: string | string[] | undefined): BedSummaryFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "libres" || value === "disponibles") return "libres";
  return "inventario";
}

type BedRow = { id: string; status: string };

/** Count beds with catalog status `available` (operational inventory). */
export function countBedsInInventory(beds: BedRow[]) {
  return beds.filter((b) => b.status === "available").length;
}

/**
 * Beds in inventory with no guest in-house today (matches mapa de camas “Libre”).
 */
export function countBedsFreeToday(
  beds: BedRow[],
  occupancyMap: Map<string, BedOccupancyDetail>,
) {
  return beds.filter((b) => {
    if (b.status !== "available") return false;
    return !(occupancyMap.get(b.id)?.in_house_today ?? false);
  }).length;
}

export function computeBedSummaryCounts(
  beds: BedRow[],
  occupancyMap: Map<string, BedOccupancyDetail>,
): BedSummaryCounts {
  return {
    inventario: countBedsInInventory(beds),
    libres: countBedsFreeToday(beds, occupancyMap),
  };
}
