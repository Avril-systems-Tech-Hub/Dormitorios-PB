"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FinanceDaySelect } from "@/components/dashboard/finance-day-select";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import { FinanceWeekSelect } from "@/components/dashboard/finance-week-select";
import { cn } from "@/lib/utils";
import type { CashCutPeriodStats, CashMovementPeriodStats } from "@/lib/cash-cuts-insights";
import { parseReservationPeriod, type ReservationPeriod } from "@/lib/dates";

type CashCutsOverviewProps = {
  cutPeriod: ReservationPeriod;
  periodLabel: string;
  monthLabel: string;
  selectedMonth: string;
  selectedDay: string;
  selectedWeek: string;
  monthOptions: { value: string; label: string }[];
  dayOptions: { value: string; label: string }[];
  weekOptions: { value: string; label: string }[];
  cutStats: CashCutPeriodStats;
  movementStats: CashMovementPeriodStats;
};

const PERIOD_OPTIONS: { value: ReservationPeriod; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

const CORTES_TABLE_CLEAR_PARAMS = ["cuts_page", "movs_page", "page"];

export function CashCutsOverview({
  cutPeriod,
  periodLabel,
  monthLabel,
  selectedMonth,
  selectedDay,
  selectedWeek,
  monthOptions,
  dayOptions,
  weekOptions,
  cutStats,
  movementStats,
}: CashCutsOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePeriod = parseReservationPeriod(searchParams.get("cutPeriod") ?? cutPeriod);

  const setCutPeriod = (next: ReservationPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "month") {
      params.delete("cutPeriod");
    } else {
      params.set("cutPeriod", next);
    }
    for (const key of CORTES_TABLE_CLEAR_PARAMS) {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `/dashboard/cash-cuts?${qs}` : "/dashboard/cash-cuts");
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-main">Resumen de cortes</h2>
          <p className="mt-1 text-sm capitalize text-text-muted">{periodLabel}</p>
          <p className="mt-0.5 text-xs text-text-muted">Mes: {monthLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FinanceMonthSelect
            value={selectedMonth}
            options={monthOptions}
            clearParams={CORTES_TABLE_CLEAR_PARAMS}
            className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
          />
          {activePeriod === "day" ? (
            <FinanceDaySelect
              value={selectedDay}
              options={dayOptions}
              monthKey={selectedMonth}
              clearParams={CORTES_TABLE_CLEAR_PARAMS}
              className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
            />
          ) : null}
          {activePeriod === "week" ? (
            <FinanceWeekSelect
              value={selectedWeek}
              options={weekOptions}
              monthKey={selectedMonth}
              clearParams={CORTES_TABLE_CLEAR_PARAMS}
              className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
            />
          ) : null}
          <div
            className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
            role="group"
            aria-label="Periodo de cortes"
          >
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCutPeriod(value)}
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cortes en el periodo"
          value={String(cutStats.cutCount)}
          hint={
            cutStats.leakageCount > 0
              ? `${cutStats.leakageCount} con diferencia (leakage)`
              : "Sin alertas de leakage"
          }
          badge={cutStats.leakageCount > 0 ? "Revisar" : "OK"}
          badgeVariant={cutStats.leakageCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Total registrado en cortes"
          value={`$${cutStats.totalIncome.toFixed(2)}`}
          hint={`Efectivo $${cutStats.totalCash.toFixed(2)} · Transfer $${cutStats.totalTransfer.toFixed(2)} · Tarjeta $${cutStats.totalCard.toFixed(2)}`}
          badge="Cortes"
          badgeVariant="success"
        />
        <StatCard
          label="Movimientos de ingreso"
          value={`$${movementStats.incomeTotal.toFixed(2)}`}
          hint={`${movementStats.incomeCount} ingreso${movementStats.incomeCount === 1 ? "" : "s"} manual${movementStats.incomeCount === 1 ? "" : "es"}`}
          badge="Ingresos"
          badgeVariant="success"
        />
        <StatCard
          label="Movimientos de egreso"
          value={`$${movementStats.expenseTotal.toFixed(2)}`}
          hint={`${movementStats.expenseCount} egreso${movementStats.expenseCount === 1 ? "" : "s"} · Dif. cortes: $${cutStats.totalDifference.toFixed(2)}`}
          badge="Egresos"
          badgeVariant="warning"
        />
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
  hint,
  badge,
  badgeVariant,
}: {
  label: string;
  value: string;
  hint: string;
  badge: string;
  badgeVariant: "success" | "warning";
}) {
  return (
    <Card className="border-border-soft bg-white p-3 shadow-none">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text-main">{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
      <Badge variant={badgeVariant} className="mt-2">
        {badge}
      </Badge>
    </Card>
  );
}
