"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import type { DayFinanceSummary } from "@/lib/day-finance";
import type { ReservationPeriod } from "@/lib/dates";

type FinanceResultCardProps = {
  day: DayFinanceSummary;
  week: DayFinanceSummary;
  month: DayFinanceSummary;
  weekLabel: string;
  monthLabel: string;
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
};

const PERIOD_OPTIONS: { value: ReservationPeriod; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

const PERIOD_TITLES: Record<ReservationPeriod, string> = {
  day: "Resultado del día",
  week: "Resultado de la semana",
  month: "Resultado del mes",
};

export function FinanceResultCard({
  day,
  week,
  month,
  weekLabel,
  monthLabel,
  selectedMonth,
  monthOptions,
}: FinanceResultCardProps) {
  const [period, setPeriod] = useState<ReservationPeriod>("month");
  const finance = period === "day" ? day : period === "week" ? week : month;
  const rangeLabel = period === "week" ? weekLabel : null;

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-text-muted">{PERIOD_TITLES[period]}</p>
        <div
          className="inline-flex shrink-0 rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
          role="group"
          aria-label="Periodo del resultado"
        >
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition",
                period === value
                  ? "bg-white text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {period === "week" && rangeLabel ? (
        <p className="mt-0.5 text-xs capitalize text-text-muted">{rangeLabel}</p>
      ) : null}
      {period === "month" ? (
        <FinanceMonthSelect value={selectedMonth} options={monthOptions} />
      ) : null}

      <p className="mt-1 text-2xl font-semibold">${finance.netResult.toFixed(2)}</p>
      <p className="mt-1 text-xs text-text-muted">
        Ingresos ${finance.totalGuestIncome.toFixed(2)} · Gastos ${finance.totalExpenses.toFixed(2)}
      </p>
      <Badge variant={finance.netResult >= 0 ? "success" : "warning"} className="mt-2">
        {finance.netResult >= 0 ? "Positivo" : "Negativo"}
      </Badge>
      <Link
        href="/dashboard/expenses"
        className="mt-2 inline-block text-xs text-brand-primary underline"
      >
        Ver gastos
      </Link>
    </Card>
  );
}
