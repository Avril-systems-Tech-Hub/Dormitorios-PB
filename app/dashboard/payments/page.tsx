import { Suspense } from "react";
import { registerPaymentAction } from "@/actions/operations";
import { PaymentRegisterPanel } from "@/components/dashboard/payment-register-panel";
import { PaymentsOverview } from "@/components/dashboard/payments-overview";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModulePermission } from "@/lib/auth/guards";
import {
  financeMonthKeyToAnchorDate,
  getFinanceDayOptions,
  getFinanceMonthOptions,
  getFinanceWeekOptions,
  getMexicoCityDateString,
  getReservationPeriodBounds,
  parseFinanceDayKey,
  parseFinanceMonthKey,
  parseFinanceWeekAnchor,
} from "@/lib/dates";
import { parseFolioSummaryFilter } from "@/lib/folio-summary";
import {
  aggregatePaymentStats,
  FOLIO_STATUS_LABELS,
  OPEN_FOLIOS_SORT_KEYS,
  OPEN_FOLIOS_TABLE_COLUMNS,
  PAYMENTS_TABLE_COLUMNS,
  PAYMENTS_TABLE_SORT_KEYS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  filterPaymentsByFolioStatus,
  getPayPeriodAnchor,
  getPayPeriodBounds,
  paginateRows,
  parsePayPeriod,
  sortOpenFolios,
  sortPaymentTransactions,
  sumOpenFolioBalances,
} from "@/lib/payment-insights";
import { parseTableSort } from "@/lib/table-controls";
import { parsePagination } from "@/lib/pagination";
import type { FolioPaymentStatus, PaymentMethod } from "@/types/domain";
import type { TableColumnConfig } from "@/lib/table-controls";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("payments");
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);

  const today = getMexicoCityDateString();
  const payPeriod = parsePayPeriod(params.payPeriod);
  const folioFilter = parseFolioSummaryFilter(params.folioFilter);
  const selectedMonth = parseFinanceMonthKey(params.financeMonth, today);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const selectedDay = parseFinanceDayKey(params.financeDay, selectedMonth, today);
  const selectedWeek = parseFinanceWeekAnchor(params.financeWeek, selectedMonth, today);
  const periodAnchor = getPayPeriodAnchor(payPeriod, selectedDay, selectedWeek, monthAnchor);
  const periodBounds = getPayPeriodBounds(payPeriod, periodAnchor);
  const periodLabel = getReservationPeriodBounds(payPeriod, periodAnchor).label;

  const monthOptions = getFinanceMonthOptions(24, today);
  const dayOptions = getFinanceDayOptions(selectedMonth);
  const weekOptions = getFinanceWeekOptions(selectedMonth);

  const supabase = createAdminClient();

  const [
    { data: foliosForForm },
    { data: periodPayments },
    { data: openFolios },
    { count: paidFolioCount },
    { data: paymentsRaw },
    { data: pendingFoliosRaw },
  ] = await Promise.all([
    supabase
      .from("folios")
      .select("id,folio_code,total_amount,paid_amount,balance_due,payment_status")
      .neq("payment_status", "liquidated")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("payments")
      .select("amount, method")
      .gte("received_at", periodBounds.startAt)
      .lte("received_at", periodBounds.endAt),
    supabase
      .from("folios")
      .select("balance_due")
      .neq("payment_status", "liquidated"),
    supabase
      .from("folios")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "liquidated"),
    supabase
      .from("payments")
      .select("id,amount,method,payment_type,received_at,folios!inner(folio_code,payment_status)")
      .gte("received_at", periodBounds.startAt)
      .lte("received_at", periodBounds.endAt)
      .order("received_at", { ascending: false }),
    supabase
      .from("folios")
      .select("id,folio_code,total_amount,paid_amount,balance_due,payment_status")
      .neq("payment_status", "liquidated")
      .order("balance_due", { ascending: false }),
  ]);

  const periodStats = aggregatePaymentStats(periodPayments);
  const openFolioStats = sumOpenFolioBalances(openFolios);

  let tableColumns: TableColumnConfig[];
  let tableRows: (string | ReturnType<typeof Badge>)[][];
  let totalCount: number;
  let sortColumn: string;
  let sortDirection: "asc" | "desc";
  let searchPlaceholder = "Buscar por folio…";
  let visibleAmountTotal: number | undefined;
  let visibleAmountLabel: string | undefined;

  if (folioFilter === "por_pagar") {
    ({ column: sortColumn, direction: sortDirection } = parseTableSort(
      params,
      OPEN_FOLIOS_SORT_KEYS,
      "saldo",
      "desc",
    ));
    tableColumns = OPEN_FOLIOS_TABLE_COLUMNS;

    let pendingFolios = pendingFoliosRaw ?? [];
    if (q) {
      const needle = q.toLowerCase();
      pendingFolios = pendingFolios.filter((folio) =>
        folio.folio_code.toLowerCase().includes(needle),
      );
    }

    const paged = paginateRows(
      sortOpenFolios(pendingFolios, sortColumn, sortDirection),
      page,
      pageSize,
    );

    tableRows = paged.rows.map((folio) => {
      const status = folio.payment_status as FolioPaymentStatus;
      return [
        folio.folio_code,
        `$${Number(folio.total_amount).toFixed(2)}`,
        `$${Number(folio.paid_amount).toFixed(2)}`,
        `$${Number(folio.balance_due).toFixed(2)}`,
        <Badge
          key={`${folio.id}-status`}
          variant={status === "liquidated" ? "success" : "warning"}
        >
          {FOLIO_STATUS_LABELS[status] ?? status}
        </Badge>,
      ];
    });
    totalCount = paged.totalCount;
    searchPlaceholder = "Buscar folio con saldo…";
    visibleAmountTotal = Number(
      paged.rows.reduce((sum, folio) => sum + Number(folio.balance_due), 0).toFixed(2),
    );
    visibleAmountLabel = "Saldo en página";
  } else {
    ({ column: sortColumn, direction: sortDirection } = parseTableSort(
      params,
      PAYMENTS_TABLE_SORT_KEYS,
      "monto",
      "desc",
    ));
    tableColumns = PAYMENTS_TABLE_COLUMNS;

    let payments = filterPaymentsByFolioStatus(paymentsRaw, folioFilter);

    if (q) {
      const needle = q.toLowerCase();
      payments = payments.filter((payment) => {
        const folio = payment.folios as
          | { folio_code?: string }
          | { folio_code?: string }[]
          | undefined;
        const folioCode = Array.isArray(folio) ? folio[0]?.folio_code : folio?.folio_code;
        return (folioCode ?? "").toLowerCase().includes(needle);
      });
    }

    const paged = paginateRows(
      sortPaymentTransactions(payments, sortColumn, sortDirection),
      page,
      pageSize,
    );

    tableRows = paged.rows.map((payment) => {
      const folio = payment.folios as
        | { folio_code?: string; payment_status?: string }
        | undefined;
      const method = payment.method as PaymentMethod;
      const status = (folio?.payment_status ?? "pending") as FolioPaymentStatus;
      return [
        folio?.folio_code ?? "Sin folio",
        `$${Number(payment.amount).toFixed(2)}`,
        PAYMENT_METHOD_LABELS[method] ?? payment.method,
        PAYMENT_TYPE_LABELS[payment.payment_type as keyof typeof PAYMENT_TYPE_LABELS] ??
          payment.payment_type,
        new Date(payment.received_at).toLocaleString("es-MX"),
        <Badge
          key={`${payment.id}-status`}
          variant={status === "liquidated" ? "success" : "warning"}
        >
          {FOLIO_STATUS_LABELS[status] ?? status}
        </Badge>,
      ];
    });
    totalCount = paged.totalCount;
    visibleAmountTotal = Number(
      paged.rows.reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2),
    );
    visibleAmountLabel = "Total en página";
  }

  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-xl border border-border-soft bg-surface-soft" />
        }
      >
        <PaymentsOverview
          payPeriod={payPeriod}
          periodLabel={periodLabel}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedWeek={selectedWeek}
          monthOptions={monthOptions}
          dayOptions={dayOptions}
          weekOptions={weekOptions}
          periodStats={periodStats}
          openFolioStats={openFolioStats}
          folioFilter={folioFilter}
          paidFolioCount={paidFolioCount ?? 0}
        />
      </Suspense>

      <ResponsiveTable
        columns={tableColumns}
        rows={tableRows}
        filterMode="global"
        serverPagination={{
          page,
          pageSize,
          totalCount,
          searchQuery: q,
          searchPlaceholder,
          visibleAmountTotal,
          visibleAmountLabel,
        }}
        serverSort={{ column: sortColumn, direction: sortDirection }}
      />

      <PaymentRegisterPanel action={registerPaymentAction} folios={foliosForForm ?? []} />
    </div>
  );
}
