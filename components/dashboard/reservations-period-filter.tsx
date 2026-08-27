"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FinanceDaySelect } from "@/components/dashboard/finance-day-select";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import { FinanceWeekSelect } from "@/components/dashboard/finance-week-select";
import { cn } from "@/lib/utils";
import type { ReservationPeriod } from "@/lib/dates";

const PERIOD_OPTIONS: { value: ReservationPeriod; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

export function ReservationsPeriodFilter({
  period,
  periodLabel,
  selectedMonth,
  selectedDay,
  selectedWeek,
  monthOptions,
  dayOptions,
  weekOptions,
  basePath = "/dashboard/reservations",
  paramPrefix,
}: {
  period: ReservationPeriod;
  periodLabel: string;
  selectedMonth: string;
  selectedDay?: string;
  selectedWeek?: string;
  monthOptions: { value: string; label: string }[];
  dayOptions?: { value: string; label: string }[];
  weekOptions?: { value: string; label: string }[];
  basePath?: string;
  paramPrefix?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodKey = paramPrefix ? `${paramPrefix}_period` : "period";
  const pageKey = paramPrefix ? `${paramPrefix}_page` : "page";
  const monthParam = paramPrefix ? `${paramPrefix}_financeMonth` : "financeMonth";

  function setPeriod(next: ReservationPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(periodKey, next);
    params.delete(pageKey);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FinanceMonthSelect
          value={selectedMonth}
          options={monthOptions}
          ariaLabel="Mes de reservaciones"
          className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
          monthParam={monthParam}
          clearParams={[pageKey]}
        />
        {period === "day" && selectedDay && dayOptions ? (
          <FinanceDaySelect
            value={selectedDay}
            options={dayOptions}
            monthKey={selectedMonth}
            clearParams={[pageKey]}
          />
        ) : null}
        {period === "week" && selectedWeek && weekOptions ? (
          <FinanceWeekSelect
            value={selectedWeek}
            options={weekOptions}
            monthKey={selectedMonth}
            clearParams={[pageKey]}
          />
        ) : null}
        <p className="text-sm capitalize text-text-muted">{periodLabel}</p>
      </div>
      <div
        className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
        role="group"
        aria-label="Periodo de reservas"
      >
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition",
              period === option.value
                ? "bg-white text-text-main shadow-sm"
                : "text-text-muted hover:text-text-main",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
