import { Suspense } from "react";
import { ExpenseRegisterPanel } from "@/components/dashboard/expense-register-panel";
import { ExpenseDeleteButton } from "@/components/dashboard/expense-delete-button";
import { ShiftExpenseRowActions } from "@/components/dashboard/shift-expense-row-actions";
import { PaymentsExpensesComparison } from "@/components/dashboard/payments-expenses-comparison";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { requireModulePermission } from "@/lib/auth/guards";
import { getExpenseConceptLabel } from "@/lib/expense-concepts";
import { formatOpenShiftLabel, getOpenShift, getShiftExpenseTotal } from "@/lib/open-shift";
import {
  getDayFinanceSummary,
  getMonthFinanceSummary,
  getWeekFinanceSummary,
} from "@/lib/day-finance";
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
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";
import type { ExpenseConcept } from "@/types/domain";
import type { ReactNode } from "react";

const EXPENSE_RECEIPTS_BUCKET = "expense-receipts";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireModulePermission("expenses");
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const today = getMexicoCityDateString();
  const isReception = profile.role === "reception";
  const openShift = await getOpenShift(profile.id);
  const shiftLabel = openShift ? formatOpenShiftLabel(openShift) : undefined;
  const shiftExpenseTotal = openShift ? await getShiftExpenseTotal(openShift.id) : 0;

  if (isReception) {
    const { data: shiftCut } = openShift
      ? await adminSupabase
          .from("cash_cuts")
          .select("id")
          .eq("shift_id", openShift.id)
          .limit(1)
          .maybeSingle()
      : { data: null };
    const canEditShiftExpenses = Boolean(openShift && !shiftCut);

    const { data: expenses, count } = openShift
      ? await adminSupabase
          .from("cash_movements")
          .select(
            "id,movement_date,expense_concept,concept_detail,amount,method,notes,receipt_image_path,recorded_at,profiles:responsible_profile_id(full_name)",
            { count: "exact" },
          )
          .eq("direction", "expense")
          .eq("shift_id", openShift.id)
          .order("recorded_at", { ascending: false })
          .range(from, to)
      : { data: [], count: 0 };

    const rows = await Promise.all(
      (expenses ?? []).map(async (expense) => {
        const expenseProfile = expense.profiles as { full_name?: string } | undefined;
        let photoCell: ReactNode = "—";

        if (expense.receipt_image_path) {
          const { data } = await adminSupabase.storage
            .from(EXPENSE_RECEIPTS_BUCKET)
            .createSignedUrl(expense.receipt_image_path, 3600);
          if (data?.signedUrl) {
            photoCell = (
              <a
                key={`photo-${expense.id}`}
                href={data.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-primary underline"
              >
                Ver foto
              </a>
            );
          }
        }

        const conceptLabel = getExpenseConceptLabel(expense.expense_concept);
        const detail =
          expense.expense_concept === "extras" && expense.concept_detail
            ? `${conceptLabel}: ${expense.concept_detail}`
            : conceptLabel;

        return [
          detail,
          `$${Number(expense.amount).toFixed(2)}`,
          METHOD_LABELS[expense.method] ?? expense.method,
          expenseProfile?.full_name ?? "Sin usuario",
          expense.notes ?? "—",
          photoCell,
          new Date(expense.recorded_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
          <ShiftExpenseRowActions
            key={`actions-${expense.id}`}
            expense={{
              id: expense.id,
              expenseConcept: expense.expense_concept as ExpenseConcept | null,
              conceptDetail: expense.concept_detail,
              amount: Number(expense.amount),
              method: expense.method,
              notes: expense.notes,
              canEdit: canEditShiftExpenses,
            }}
          />,
        ];
      }),
    );

    return (
      <div className="space-y-4">
        <ExpenseRegisterPanel
          returnTo="/dashboard/expenses"
          hasOpenShift={Boolean(openShift)}
          shiftLabel={shiftLabel}
          shiftExpenseTotal={openShift ? shiftExpenseTotal : undefined}
          defaultOpen={!openShift || (count ?? 0) === 0}
        />
        <Card>
          <h3 className="text-base font-semibold text-text-main">
            {openShift ? "Egresos del turno activo" : "Egresos del turno"}
          </h3>
          <p className="mt-0.5 text-sm text-text-muted">
            {openShift
              ? `${shiftLabel}. Total del turno: $${shiftExpenseTotal.toFixed(2)}${
                  canEditShiftExpenses
                    ? " Puedes editar un registro si te equivocaste; el cambio queda en el historial."
                    : " Este turno ya tiene corte; solo puedes consultar."
                }`
              : "No hay turno abierto. Inicia turno en Turnos para registrar y ver egresos por turno."}
          </p>
          <div className="mt-3">
            <ResponsiveTable
              headers={[
                "Concepto",
                "Monto",
                "Método",
                "Responsable",
                "Notas",
                "Foto",
                "Registrado",
                "Acciones",
              ]}
              rows={rows}
              serverPagination={{
                page,
                pageSize,
                totalCount: count ?? 0,
              }}
            />
          </div>
        </Card>
      </div>
    );
  }

  const expensePeriod = parseReservationPeriod(params.expensePeriod);
  const selectedMonth = parseFinanceMonthKey(params.financeMonth, today);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const selectedDay = parseFinanceDayKey(params.financeDay, selectedMonth, today);
  const selectedWeek = parseFinanceWeekAnchor(params.financeWeek, selectedMonth, today);
  const periodAnchor = getPayPeriodAnchor(expensePeriod, selectedDay, selectedWeek, monthAnchor);
  const periodBounds = getPayPeriodBounds(expensePeriod, periodAnchor);
  const periodLabel = getReservationPeriodBounds(expensePeriod, periodAnchor).label;

  const monthOptions = getFinanceMonthOptions(24, today);
  const dayOptions = getFinanceDayOptions(selectedMonth);
  const weekOptions = getFinanceWeekOptions(selectedMonth);

  const summaryPromise =
    expensePeriod === "day"
      ? getDayFinanceSummary(supabase, selectedDay)
      : expensePeriod === "week"
        ? getWeekFinanceSummary(supabase, selectedWeek)
        : getMonthFinanceSummary(supabase, monthAnchor);

  const [summary, { count: paymentCount }, { count: expenseCount }] = await Promise.all([
    summaryPromise,
    adminSupabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .gte("effective_date", periodBounds.start)
      .lte("effective_date", periodBounds.end),
    adminSupabase
      .from("cash_movements")
      .select("id", { count: "exact", head: true })
      .eq("direction", "expense")
      .gte("movement_date", periodBounds.start)
      .lte("movement_date", periodBounds.end),
  ]);

  let query = adminSupabase
    .from("cash_movements")
    .select(
      "id,movement_date,expense_concept,concept_detail,amount,method,notes,receipt_image_path,recorded_at,profiles:responsible_profile_id(full_name)",
      { count: "exact" },
    )
    .eq("direction", "expense")
    .gte("movement_date", periodBounds.start)
    .lte("movement_date", periodBounds.end);

  if (q) {
    const safe = escapeIlike(q);
    query = query.or(`notes.ilike.%${safe}%,concept_detail.ilike.%${safe}%`);
  }

  const { data: expenses, count } = await query
    .order("recorded_at", { ascending: false })
    .range(from, to);

  const rows = await Promise.all(
    (expenses ?? []).map(async (expense) => {
      const profile = expense.profiles as { full_name?: string } | undefined;
      let photoCell: ReactNode = "—";

      if (expense.receipt_image_path) {
        const { data } = await adminSupabase.storage
          .from(EXPENSE_RECEIPTS_BUCKET)
          .createSignedUrl(expense.receipt_image_path, 3600);
        if (data?.signedUrl) {
          photoCell = (
            <a
              key={`photo-${expense.id}`}
              href={data.signedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-primary underline"
            >
              Ver foto
            </a>
          );
        }
      }

      const conceptLabel = getExpenseConceptLabel(expense.expense_concept);
      const detail =
        expense.expense_concept === "extras" && expense.concept_detail
          ? `${conceptLabel}: ${expense.concept_detail}`
          : conceptLabel;

      return [
        expense.movement_date,
        detail,
        `$${Number(expense.amount).toFixed(2)}`,
        METHOD_LABELS[expense.method] ?? expense.method,
        profile?.full_name ?? "Sin usuario",
        expense.notes ?? "—",
        photoCell,
        new Date(expense.recorded_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
        <ExpenseDeleteButton
          key={`delete-${expense.id}`}
          movementId={expense.id}
          concept={detail}
          amount={Number(expense.amount)}
        />,
      ];
    }),
  );

  const tableSubtitle =
    expensePeriod === "day"
      ? `Gastos registrados el ${periodLabel}`
      : expensePeriod === "week"
        ? `Gastos de la semana (${periodLabel})`
        : `Gastos de ${formatMexicoCityMonthLabel(monthAnchor)}`;

  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-xl border border-border-soft bg-surface-soft" />
        }
      >
        <PaymentsExpensesComparison
          summary={summary}
          periodLabel={periodLabel}
          paymentCount={paymentCount ?? 0}
          expenseCount={expenseCount ?? 0}
          periodControls={{
            period: expensePeriod,
            periodParam: "expensePeriod",
            selectedMonth,
            selectedDay,
            selectedWeek,
            monthOptions,
            dayOptions,
            weekOptions,
          }}
        />
      </Suspense>

      <Card>
        <h3 className="text-base font-semibold text-text-main">Gastos del periodo</h3>
        <p className="mt-0.5 text-sm capitalize text-text-muted">{tableSubtitle}</p>
        <div className="mt-3">
          <ResponsiveTable
            headers={[
              "Fecha",
              "Concepto",
              "Monto",
              "Método",
              "Responsable",
              "Notas",
              "Foto",
              "Registrado",
              "Acciones",
            ]}
            rows={rows}
            filterMode="global"
            serverPagination={{
              page,
              pageSize,
              totalCount: count ?? 0,
              searchQuery: q,
              searchPlaceholder: "Buscar por concepto o notas…",
            }}
          />
        </div>
      </Card>

      <ExpenseRegisterPanel
        returnTo="/dashboard/expenses"
        hasOpenShift={Boolean(openShift)}
        shiftLabel={shiftLabel}
        shiftExpenseTotal={openShift ? shiftExpenseTotal : undefined}
        defaultOpen={Boolean(openShift)}
      />
    </div>
  );
}
