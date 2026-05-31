"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DayFinanceSummary } from "@/lib/day-finance";

type FinanceResultCardProps = {
  day: DayFinanceSummary;
  month: DayFinanceSummary;
  monthLabel: string;
};

export function FinanceResultCard({ day, month, monthLabel }: FinanceResultCardProps) {
  const [period, setPeriod] = useState<"day" | "month">("day");
  const finance = period === "day" ? day : month;

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-text-muted">
          {period === "day" ? "Resultado del día" : "Resultado del mes"}
        </p>
        <div
          className="inline-flex shrink-0 rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
          role="group"
          aria-label="Periodo del resultado"
        >
          <button
            type="button"
            onClick={() => setPeriod("day")}
            className={cn(
              "rounded-md px-2 py-1 font-medium transition",
              period === "day"
                ? "bg-white text-text-main shadow-sm"
                : "text-text-muted hover:text-text-main",
            )}
          >
            Día
          </button>
          <button
            type="button"
            onClick={() => setPeriod("month")}
            className={cn(
              "rounded-md px-2 py-1 font-medium transition",
              period === "month"
                ? "bg-white text-text-main shadow-sm"
                : "text-text-muted hover:text-text-main",
            )}
          >
            Mes
          </button>
        </div>
      </div>

      {period === "month" ? (
        <p className="mt-0.5 text-xs capitalize text-text-muted">{monthLabel}</p>
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
