import type { FolioPaymentStatus } from "@/types/domain";

/** Dashboard folio KPI filter — maps to `folios.payment_status` (+ combined views). */
export type FolioSummaryFilter = "por_pagar" | "pagados" | "todos";

export type FolioSummaryCounts = Record<FolioSummaryFilter, number>;

export const FOLIO_PAYMENT_STATUSES: FolioPaymentStatus[] = ["pending", "partial", "liquidated"];

export const FOLIO_SUMMARY_FILTERS: {
  value: FolioSummaryFilter;
  toggleLabel: string;
  title: string;
  badge: string;
  badgeVariant: "success" | "warning";
  hint?: string;
}[] = [
  {
    value: "pagados",
    toggleLabel: "Pagados",
    title: "Folios pagados",
    badge: "Liquidado",
    badgeVariant: "success",
  },
  {
    value: "por_pagar",
    toggleLabel: "Por pagar",
    title: "Folios por pagar",
    badge: "Con saldo pendiente",
    badgeVariant: "warning",
    hint: "Sin pago o pago parcial",
  },
  {
    value: "todos",
    toggleLabel: "Todos",
    title: "Todos los folios",
    badge: "Histórico",
    badgeVariant: "success",
  },
];

const LEGACY_FOLIO_FILTER_ALIASES: Record<string, FolioSummaryFilter> = {
  por_liquidar: "por_pagar",
  pendiente: "por_pagar",
  parcial: "por_pagar",
};

export function getFolioSummaryMeta(filter: FolioSummaryFilter) {
  return FOLIO_SUMMARY_FILTERS.find((f) => f.value === filter) ?? FOLIO_SUMMARY_FILTERS[1];
}

export function parseFolioSummaryFilter(
  raw: string | string[] | undefined,
): FolioSummaryFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "por_pagar";
  const normalized = LEGACY_FOLIO_FILTER_ALIASES[value] ?? value;
  if (FOLIO_SUMMARY_FILTERS.some((f) => f.value === normalized)) {
    return normalized as FolioSummaryFilter;
  }
  return "por_pagar";
}
