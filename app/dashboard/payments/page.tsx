import { Suspense } from "react";
import { registerPaymentAction } from "@/actions/operations";
import { PaymentRegisterPanel } from "@/components/dashboard/payment-register-panel";
import { PaymentsOverview } from "@/components/dashboard/payments-overview";
import { Badge } from "@/components/ui/badge";
import { FolioGuestCell } from "@/components/ui/folio-guest-cell";
import { PaymentCorrectionButton } from "@/components/ui/payment-correction-button";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModulePermission } from "@/lib/auth/guards";
import { canMutate } from "@/lib/auth/roles";
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
import { summarizeFolioGuests } from "@/lib/folio-guests";
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
  type OpenFolioRow,
  type PaymentTransactionRow,
} from "@/lib/payment-insights";
import { parseTableSort } from "@/lib/table-controls";
import { parsePagination } from "@/lib/pagination";
import type { FolioPaymentStatus, PaymentMethod } from "@/types/domain";
import type { TableColumnConfig } from "@/lib/table-controls";
import type { FilterableCell } from "@/components/ui/filterable-cell";

const FOLIO_GUESTS_SELECT =
  "reservations(id,nights,reservation_guests(id,guest_id,locker_number,locker_days,guests(full_name,phone,email),beds(bed_number,zone)))";

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireModulePermission("payments");
  const allowMutations = canMutate(profile.role);
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
    { data: paymentsRaw, error: paymentsError },
    { data: paymentCorrections },
    { data: pendingFoliosRaw, error: pendingError },
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
      .gte("effective_date", periodBounds.start)
      .lte("effective_date", periodBounds.end),
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
      .select(
        `id,amount,method,payment_type,effective_date,captured_at,balance_after,is_reversal,reversal_of_payment_id,reversal_reason,receiver:profiles!payments_received_by_fkey(full_name),folios!inner(folio_code,payment_status,${FOLIO_GUESTS_SELECT})`,
      )
      .gte("effective_date", periodBounds.start)
      .lte("effective_date", periodBounds.end)
      .order("effective_date", { ascending: false })
      .order("captured_at", { ascending: false }),
    supabase
      .from("payments")
      .select("reversal_of_payment_id,amount")
      .eq("is_reversal", true),
    supabase
      .from("folios")
      .select(`id,folio_code,total_amount,paid_amount,balance_due,payment_status,${FOLIO_GUESTS_SELECT}`)
      .neq("payment_status", "liquidated")
      .order("balance_due", { ascending: false }),
  ]);

  if (paymentsError) {
    throw new Error(`No se pudieron cargar los pagos: ${paymentsError.message}`);
  }
  if (pendingError) {
    throw new Error(`No se pudieron cargar los folios por pagar: ${pendingError.message}`);
  }

  const periodStats = aggregatePaymentStats(periodPayments);
  const openFolioStats = sumOpenFolioBalances(openFolios);

  let tableColumns: TableColumnConfig[];
  let tableRows: FilterableCell[][];
  let totalCount: number;
  let sortColumn: string;
  let sortDirection: "asc" | "desc";
  let searchPlaceholder = "Buscar por huésped o folio…";
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

    let pendingFolios = (pendingFoliosRaw ?? []) as OpenFolioRow[];
    if (q) {
      const needle = q.toLowerCase();
      pendingFolios = pendingFolios.filter((folio) =>
        summarizeFolioGuests(folio).searchText.toLowerCase().includes(needle),
      );
    }

    const paged = paginateRows(
      sortOpenFolios(pendingFolios, sortColumn, sortDirection),
      page,
      pageSize,
    );

    tableRows = paged.rows.map((folio) => {
      const status = folio.payment_status as FolioPaymentStatus;
      const guestSummary = summarizeFolioGuests(folio);
      return [
        ft(
          guestSummary.searchText,
          <FolioGuestCell
            key={`${folio.id}-guest`}
            primaryName={guestSummary.primaryName}
            folioCode={guestSummary.folioCode}
            guests={guestSummary.guests}
            reservationId={guestSummary.reservationId}
            nights={guestSummary.nights}
          />,
        ),
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
    searchPlaceholder = "Buscar huésped o folio con saldo…";
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
    tableColumns = allowMutations
      ? PAYMENTS_TABLE_COLUMNS
      : PAYMENTS_TABLE_COLUMNS.filter((column) => column.key !== "correccion");

    let payments = filterPaymentsByFolioStatus(
      paymentsRaw as PaymentTransactionRow[] | null,
      folioFilter,
    );

    if (q) {
      const needle = q.toLowerCase();
      payments = payments.filter((payment) => {
        const folio = unwrapRelation(payment.folios);
        return summarizeFolioGuests(folio).searchText.toLowerCase().includes(needle);
      });
    }

    const paged = paginateRows(
      sortPaymentTransactions(payments, sortColumn, sortDirection),
      page,
      pageSize,
    );

    const reversedByPayment = new Map<string, number>();
    for (const correction of paymentCorrections ?? []) {
      if (!correction.reversal_of_payment_id) continue;
      reversedByPayment.set(
        correction.reversal_of_payment_id,
        (reversedByPayment.get(correction.reversal_of_payment_id) ?? 0) +
          Math.abs(Number(correction.amount)),
      );
    }

    tableRows = paged.rows.map((payment) => {
      const folio = unwrapRelation(payment.folios);
      const method = payment.method as PaymentMethod;
      const status = (folio?.payment_status ?? "pending") as FolioPaymentStatus;
      const receiver = unwrapRelation(payment.receiver);
      const isReversal = Boolean(payment.is_reversal);
      const availableAmount = Math.max(
        0,
        Number(payment.amount) - (reversedByPayment.get(payment.id) ?? 0),
      );
      const guestSummary = summarizeFolioGuests(folio);
      const row = [
        ft(
          guestSummary.searchText,
          <FolioGuestCell
            key={`${payment.id}-guest`}
            primaryName={guestSummary.primaryName}
            folioCode={guestSummary.folioCode}
            guests={guestSummary.guests}
            reservationId={guestSummary.reservationId}
            nights={guestSummary.nights}
          />,
        ),
        <span key={`${payment.id}-amount`} className={isReversal ? "font-semibold text-red-700" : undefined}>
          {isReversal ? "−" : ""}${Math.abs(Number(payment.amount)).toFixed(2)}
        </span>,
        PAYMENT_METHOD_LABELS[method] ?? payment.method,
        PAYMENT_TYPE_LABELS[payment.payment_type as keyof typeof PAYMENT_TYPE_LABELS] ??
          payment.payment_type,
        payment.effective_date,
        new Date(payment.captured_at).toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
        }),
        receiver?.full_name ?? "Sin receptor",
        payment.balance_after == null ? "—" : `$${Number(payment.balance_after).toFixed(2)}`,
        <Badge
          key={`${payment.id}-status`}
          variant={status === "liquidated" ? "success" : "warning"}
        >
          {FOLIO_STATUS_LABELS[status] ?? status}
        </Badge>,
      ];
      if (allowMutations) {
        row.push(
          isReversal ? (
            <span key={`${payment.id}-reversal`} className="text-xs text-red-700">
              Compensación
              {payment.reversal_reason ? `: ${payment.reversal_reason}` : ""}
            </span>
          ) : (
            <PaymentCorrectionButton
              key={`${payment.id}-correct`}
              paymentId={payment.id}
              availableAmount={availableAmount}
            />
          ),
        );
      }
      return row;
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

      {allowMutations ? (
        <PaymentRegisterPanel action={registerPaymentAction} folios={foliosForForm ?? []} />
      ) : null}
    </div>
  );
}
