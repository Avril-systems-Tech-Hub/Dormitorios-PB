import type { FolioPaymentStatus, PaymentMethod, PaymentType } from "@/types/domain";
import type { FolioSummaryFilter } from "@/lib/folio-summary";
import { type SortDirection, type TableColumnConfig } from "@/lib/table-controls";
import {
  getMexicoCityDayBounds,
  getMexicoCityMonthBounds,
  getMexicoCityWeekBounds,
  getReservationPeriodBounds,
  parseReservationPeriod,
  type ReservationPeriod,
} from "@/lib/dates";

export type PayPeriod = ReservationPeriod;

export type PaymentMethodBreakdown = Record<PaymentMethod, number>;

export type PaymentPeriodStats = {
  totalCollected: number;
  transactionCount: number;
  byMethod: PaymentMethodBreakdown;
};

export type OpenFolioStats = {
  count: number;
  totalBalance: number;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  advance: "Anticipo",
  settlement: "Liquidación",
  extra: "Extra",
};

/** DB `folios.payment_status` values with readable labels. */
export const FOLIO_STATUS_LABELS: Record<FolioPaymentStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  liquidated: "Liquidado",
};

export const PAYMENTS_TABLE_COLUMNS: TableColumnConfig[] = [
  { key: "folio", label: "Folio", sortable: true },
  { key: "monto", label: "Monto", sortable: true },
  { key: "metodo", label: "Método", sortable: true },
  { key: "tipo", label: "Tipo", sortable: true },
  { key: "fecha", label: "Fecha", sortable: true },
  { key: "estatus", label: "Estatus folio", sortable: true },
];

export const PAYMENTS_TABLE_SORT_KEYS = PAYMENTS_TABLE_COLUMNS.filter((column) => column.sortable).map(
  (column) => column.key,
);

export const OPEN_FOLIOS_TABLE_COLUMNS: TableColumnConfig[] = [
  { key: "folio", label: "Folio", sortable: true },
  { key: "total", label: "Total", sortable: true },
  { key: "pagado", label: "Pagado", sortable: true },
  { key: "saldo", label: "Saldo", sortable: true },
  { key: "estatus", label: "Estatus", sortable: true },
];

export const OPEN_FOLIOS_SORT_KEYS = OPEN_FOLIOS_TABLE_COLUMNS.filter((column) => column.sortable).map(
  (column) => column.key,
);

export function parsePayPeriod(value: string | string[] | undefined): PayPeriod {
  return parseReservationPeriod(value);
}

export function getPayPeriodBounds(period: PayPeriod, anchorDate: string) {
  if (period === "day") return getReservationPeriodBounds("day", anchorDate);
  if (period === "week") return getReservationPeriodBounds("week", anchorDate);
  return getReservationPeriodBounds("month", anchorDate);
}

export function getPayPeriodAnchor(
  period: PayPeriod,
  selectedDay: string,
  selectedWeek: string,
  monthAnchor: string,
) {
  if (period === "day") return selectedDay;
  if (period === "week") return selectedWeek;
  return monthAnchor;
}

type PaymentRow = { amount: number | string; method?: string | null };

export function aggregatePaymentStats(payments: PaymentRow[] | null): PaymentPeriodStats {
  const byMethod: PaymentMethodBreakdown = { cash: 0, transfer: 0, card: 0 };
  let totalCollected = 0;

  for (const payment of payments ?? []) {
    const amount = Number(payment.amount);
    totalCollected += amount;
    const method = payment.method as PaymentMethod | undefined;
    if (method && method in byMethod) {
      byMethod[method] += amount;
    }
  }

  return {
    totalCollected: Number(totalCollected.toFixed(2)),
    transactionCount: payments?.length ?? 0,
    byMethod: {
      cash: Number(byMethod.cash.toFixed(2)),
      transfer: Number(byMethod.transfer.toFixed(2)),
      card: Number(byMethod.card.toFixed(2)),
    },
  };
}

export function sumOpenFolioBalances(
  folios: { balance_due: number | string }[] | null,
): OpenFolioStats {
  const rows = folios ?? [];
  const totalBalance = rows.reduce((sum, folio) => sum + Number(folio.balance_due), 0);
  return {
    count: rows.length,
    totalBalance: Number(totalBalance.toFixed(2)),
  };
}

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export type PaymentTransactionRow = {
  id: string;
  amount: number | string;
  method: string;
  payment_type: string;
  received_at: string;
  folios?:
    | { folio_code?: string; payment_status?: string }
    | { folio_code?: string; payment_status?: string }[]
    | null;
};

export function filterPaymentsByFolioStatus(
  payments: PaymentTransactionRow[] | null,
  folioFilter: FolioSummaryFilter,
): PaymentTransactionRow[] {
  const rows = payments ?? [];
  if (folioFilter === "todos") return rows;

  return rows.filter((payment) => {
    const folio = unwrap(payment.folios);
    const status = folio?.payment_status ?? "pending";
    if (folioFilter === "pagados") return status === "liquidated";
    return status !== "liquidated";
  });
}

export type OpenFolioRow = {
  id: string;
  folio_code: string;
  total_amount: number | string;
  paid_amount: number | string;
  balance_due: number | string;
  payment_status: string;
};

export function sortOpenFolios(
  folios: OpenFolioRow[],
  column: string,
  direction: SortDirection,
): OpenFolioRow[] {
  const mult = direction === "asc" ? 1 : -1;
  return [...folios].sort((a, b) => {
    switch (column) {
      case "folio":
        return mult * a.folio_code.localeCompare(b.folio_code, "es");
      case "total":
        return mult * (Number(a.total_amount) - Number(b.total_amount));
      case "pagado":
        return mult * (Number(a.paid_amount) - Number(b.paid_amount));
      case "saldo":
        return mult * (Number(a.balance_due) - Number(b.balance_due));
      case "estatus":
        return mult * a.payment_status.localeCompare(b.payment_status, "es");
      default:
        return mult * (Number(a.balance_due) - Number(b.balance_due));
    }
  });
}

export function sortPaymentTransactions(
  payments: PaymentTransactionRow[],
  column: string,
  direction: SortDirection,
): PaymentTransactionRow[] {
  const mult = direction === "asc" ? 1 : -1;
  return [...payments].sort((a, b) => {
    const folioA = unwrap(a.folios);
    const folioB = unwrap(b.folios);

    switch (column) {
      case "folio":
        return mult * (folioA?.folio_code ?? "").localeCompare(folioB?.folio_code ?? "", "es");
      case "monto":
        return mult * (Number(a.amount) - Number(b.amount));
      case "metodo":
        return mult * a.method.localeCompare(b.method, "es");
      case "tipo":
        return mult * a.payment_type.localeCompare(b.payment_type, "es");
      case "fecha":
        return mult * a.received_at.localeCompare(b.received_at);
      case "estatus":
        return mult * (folioA?.payment_status ?? "").localeCompare(folioB?.payment_status ?? "", "es");
      default:
        return mult * (Number(a.amount) - Number(b.amount));
    }
  });
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): { rows: T[]; totalCount: number } {
  const totalCount = rows.length;
  const start = page * pageSize;
  return { rows: rows.slice(start, start + pageSize), totalCount };
}

export { getMexicoCityDayBounds, getMexicoCityMonthBounds, getMexicoCityWeekBounds };
