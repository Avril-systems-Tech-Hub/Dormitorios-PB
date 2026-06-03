import { Suspense } from "react";
import { CashCutsOverview } from "@/components/dashboard/cash-cuts-overview";
import { PaymentsExpensesComparison } from "@/components/dashboard/payments-expenses-comparison";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModulePermission } from "@/lib/auth/guards";
import {
  getDayFinanceSummary,
  getMonthFinanceSummary,
  getWeekFinanceSummary,
} from "@/lib/day-finance";
import {
  aggregateCashCutStats,
  aggregateCashMovementStats,
} from "@/lib/cash-cuts-insights";
import { getExpenseConceptLabel } from "@/lib/expense-concepts";
import {
  financeMonthKeyToAnchorDate,
  formatMexicoCityMonthLabel,
  getFinanceDayOptions,
  getFinanceMonthOptions,
  getFinanceWeekOptions,
  getMexicoCityDateString,
  getReservationPeriodBounds,
  parseFinanceDayKey,
  parseFinanceMonthKey,
  parseFinanceWeekAnchor,
  parseReservationPeriod,
} from "@/lib/dates";
import { getPayPeriodAnchor, getPayPeriodBounds } from "@/lib/payment-insights";
import { parsePagination, getRange } from "@/lib/pagination";

export default async function CashCutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("cash_cuts");
  const params = await searchParams;

  const today = getMexicoCityDateString();
  const cutPeriod = parseReservationPeriod(params.cutPeriod);
  const selectedMonth = parseFinanceMonthKey(params.financeMonth, today);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const selectedDay = parseFinanceDayKey(params.financeDay, selectedMonth, today);
  const selectedWeek = parseFinanceWeekAnchor(params.financeWeek, selectedMonth, today);
  const periodAnchor = getPayPeriodAnchor(cutPeriod, selectedDay, selectedWeek, monthAnchor);
  const periodBounds = getPayPeriodBounds(cutPeriod, periodAnchor);
  const periodLabel = getReservationPeriodBounds(cutPeriod, periodAnchor).label;
  const monthLabel = formatMexicoCityMonthLabel(monthAnchor);

  const monthOptions = getFinanceMonthOptions(24, today);
  const dayOptions = getFinanceDayOptions(selectedMonth);
  const weekOptions = getFinanceWeekOptions(selectedMonth);

  const cutsPag = parsePagination(params, "cuts");
  const movsPag = parsePagination(params, "movs");
  const [cutsFrom, cutsTo] = getRange(cutsPag.page, cutsPag.pageSize);
  const [movsFrom, movsTo] = getRange(movsPag.page, movsPag.pageSize);

  const supabase = createAdminClient();

  const financeSummaryPromise =
    cutPeriod === "day"
      ? getDayFinanceSummary(supabase, selectedDay)
      : cutPeriod === "week"
        ? getWeekFinanceSummary(supabase, selectedWeek)
        : getMonthFinanceSummary(supabase, monthAnchor);

  const [
    { data: cashCuts, count: cutsCount },
    { data: movements, count: movsCount },
    { data: cutsForStats },
    { data: movementsForStats },
    financeSummary,
    { count: paymentCount },
    { count: expenseCount },
  ] = await Promise.all([
    supabase
      .from("cash_cuts")
      .select(
        "id,total_cash,total_transfer,total_card,total_income,expected_income,actual_cash_counted,difference,leakage_flag,created_at,profiles:generated_by(full_name)",
        { count: "exact" },
      )
      .gte("created_at", periodBounds.startAt)
      .lte("created_at", periodBounds.endAt)
      .order("created_at", { ascending: false })
      .range(cutsFrom, cutsTo),
    supabase
      .from("cash_movements")
      .select(
        "id,movement_date,direction,category,expense_concept,concept_detail,amount,notes,profiles:responsible_profile_id(full_name)",
        { count: "exact" },
      )
      .gte("movement_date", periodBounds.start)
      .lte("movement_date", periodBounds.end)
      .order("recorded_at", { ascending: false })
      .range(movsFrom, movsTo),
    supabase
      .from("cash_cuts")
      .select("total_cash,total_transfer,total_card,total_income,difference,leakage_flag")
      .gte("created_at", periodBounds.startAt)
      .lte("created_at", periodBounds.endAt),
    supabase
      .from("cash_movements")
      .select("direction,amount")
      .gte("movement_date", periodBounds.start)
      .lte("movement_date", periodBounds.end),
    financeSummaryPromise,
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .gte("received_at", periodBounds.startAt)
      .lte("received_at", periodBounds.endAt),
    supabase
      .from("cash_movements")
      .select("id", { count: "exact", head: true })
      .eq("direction", "expense")
      .gte("movement_date", periodBounds.start)
      .lte("movement_date", periodBounds.end),
  ]);

  const cutStats = aggregateCashCutStats(cutsForStats);
  const movementStats = aggregateCashMovementStats(movementsForStats);

  const cutRows =
    cashCuts?.map((cut) => {
      const profile = cut.profiles as { full_name?: string } | undefined;
      return [
        new Date(cut.created_at).toLocaleString("es-MX"),
        profile?.full_name ?? "Sin usuario",
        `$${Number(cut.total_cash).toFixed(2)}`,
        `$${Number(cut.total_transfer).toFixed(2)}`,
        `$${Number(cut.total_card).toFixed(2)}`,
        `$${Number(cut.total_income).toFixed(2)}`,
        `$${Number(cut.expected_income ?? 0).toFixed(2)}`,
        `$${Number(cut.actual_cash_counted ?? 0).toFixed(2)}`,
        `$${Number(cut.difference ?? 0).toFixed(2)}`,
        cut.leakage_flag ? "Leakage" : "OK",
      ];
    }) ?? [];

  const movementRows =
    movements?.map((movement) => {
      const profile = movement.profiles as { full_name?: string } | undefined;
      const categoryLabel =
        movement.direction === "expense" && movement.expense_concept
          ? movement.expense_concept === "extras" && movement.concept_detail
            ? `Extras: ${movement.concept_detail}`
            : getExpenseConceptLabel(movement.expense_concept)
          : movement.category;
      return [
        movement.movement_date,
        movement.direction === "income" ? "Ingreso" : "Egreso",
        categoryLabel,
        `$${Number(movement.amount).toFixed(2)}`,
        profile?.full_name ?? "Sin usuario",
        movement.notes ?? "-",
      ];
    }) ?? [];

  const cutsSubtitle =
    cutPeriod === "day"
      ? `Cortes del ${periodLabel}`
      : cutPeriod === "week"
        ? `Cortes de la semana (${periodLabel})`
        : `Cortes de ${monthLabel}`;

  const movementsSubtitle =
    cutPeriod === "day"
      ? `Movimientos del ${periodLabel}`
      : cutPeriod === "week"
        ? `Movimientos de la semana (${periodLabel})`
        : `Movimientos de ${monthLabel}`;

  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-xl border border-border-soft bg-surface-soft" />
        }
      >
        <CashCutsOverview
          cutPeriod={cutPeriod}
          periodLabel={periodLabel}
          monthLabel={monthLabel}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedWeek={selectedWeek}
          monthOptions={monthOptions}
          dayOptions={dayOptions}
          weekOptions={weekOptions}
          cutStats={cutStats}
          movementStats={movementStats}
        />
      </Suspense>

      <Card>
        <h3 className="text-base font-semibold text-text-main">Cortes del periodo</h3>
        <p className="mt-0.5 text-sm capitalize text-text-muted">{cutsSubtitle}</p>
        <div className="mt-3">
          <ResponsiveTable
            headers={[
              "Fecha",
              "Responsable",
              "Efectivo",
              "Transfer",
              "Tarjeta",
              "Registrado",
              "Esperado",
              "Contado",
              "Dif",
              "Leakage",
            ]}
            rows={cutRows}
            serverPagination={{
              page: cutsPag.page,
              pageSize: cutsPag.pageSize,
              totalCount: cutsCount ?? 0,
              paramPrefix: "cuts",
            }}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-text-main">Movimientos de caja</h3>
        <p className="mt-0.5 text-sm capitalize text-text-muted">{movementsSubtitle}</p>
        <div className="mt-3">
          <ResponsiveTable
            headers={["Fecha", "Tipo", "Concepto", "Monto", "Responsable", "Notas"]}
            rows={movementRows}
            serverPagination={{
              page: movsPag.page,
              pageSize: movsPag.pageSize,
              totalCount: movsCount ?? 0,
              paramPrefix: "movs",
            }}
          />
        </div>
      </Card>

      <PaymentsExpensesComparison
        summary={financeSummary}
        periodLabel={periodLabel}
        paymentCount={paymentCount ?? 0}
        expenseCount={expenseCount ?? 0}
      />
    </div>
  );
}
