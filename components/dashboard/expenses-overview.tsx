"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FinanceDaySelect } from "@/components/dashboard/finance-day-select";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import { FinanceWeekSelect } from "@/components/dashboard/finance-week-select";
import { cn } from "@/lib/utils";
import type { DayFinanceSummary } from "@/lib/day-finance";
import { parseReservationPeriod, type ReservationPeriod } from "@/lib/dates";

type ExpensesOverviewProps = {
  expensePeriod: ReservationPeriod;
  periodLabel: string;
  selectedMonth: string;
  selectedDay: string;
  selectedWeek: string;
  monthOptions: { value: string; label: string }[];
  dayOptions: { value: string; label: string }[];
  weekOptions: { value: string; label: string }[];
  summary: DayFinanceSummary;
};

const PERIOD_OPTIONS: { value: ReservationPeriod; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

const INCOME_LABELS: Record<ReservationPeriod, string> = {
  day: "Ingresos del día (huéspedes)",
  week: "Ingresos de la semana (huéspedes)",
  month: "Ingresos del mes (huéspedes)",
};

const EXPENSE_LABELS: Record<ReservationPeriod, string> = {
  day: "Gastos del día",
  week: "Gastos de la semana",
  month: "Gastos del mes",
};

const NET_LABELS: Record<ReservationPeriod, string> = {
  day: "Resultado neto del día",
  week: "Resultado neto de la semana",
  month: "Resultado neto del mes",
};

export function ExpensesOverview({
  expensePeriod,
  periodLabel,
  selectedMonth,
  selectedDay,
  selectedWeek,
  monthOptions,
  dayOptions,
  weekOptions,
  summary,
}: ExpensesOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePeriod = parseReservationPeriod(searchParams.get("expensePeriod") ?? expensePeriod);

  const setExpensePeriod = (next: ReservationPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "month") {
      params.delete("expensePeriod");
    } else {
      params.set("expensePeriod", next);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/expenses?${qs}` : "/dashboard/expenses");
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-main">Resumen financiero</h2>
          <p className="mt-1 text-sm capitalize text-text-muted">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FinanceMonthSelect
            value={selectedMonth}
            options={monthOptions}
            className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
          />
          {activePeriod === "day" ? (
            <FinanceDaySelect
              value={selectedDay}
              options={dayOptions}
              monthKey={selectedMonth}
              className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
            />
          ) : null}
          {activePeriod === "week" ? (
            <FinanceWeekSelect
              value={selectedWeek}
              options={weekOptions}
              monthKey={selectedMonth}
              className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
            />
          ) : null}
          <div
            className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
            role="group"
            aria-label="Periodo de gastos"
          >
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setExpensePeriod(value)}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  activePeriod === value
                    ? "bg-white text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card className="border-border-soft bg-white p-3 shadow-none">
          <p className="text-sm text-text-muted">{INCOME_LABELS[activePeriod]}</p>
          <p className="mt-1 text-2xl font-semibold">${summary.totalGuestIncome.toFixed(2)}</p>
        </Card>
        <Card className="border-border-soft bg-white p-3 shadow-none">
          <p className="text-sm text-text-muted">{EXPENSE_LABELS[activePeriod]}</p>
          <p className="mt-1 text-2xl font-semibold">${summary.totalExpenses.toFixed(2)}</p>
        </Card>
        <Card className="border-border-soft bg-white p-3 shadow-none">
          <p className="text-sm text-text-muted">{NET_LABELS[activePeriod]}</p>
          <p className="mt-1 text-2xl font-semibold">${summary.netResult.toFixed(2)}</p>
          <Badge variant={summary.netResult >= 0 ? "success" : "warning"} className="mt-2">
            {summary.netResult >= 0 ? "Positivo" : "Negativo"}
          </Badge>
        </Card>
      </div>
    </Card>
  );
}
