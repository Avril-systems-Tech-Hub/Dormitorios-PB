"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FinanceDaySelect } from "@/components/dashboard/finance-day-select";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import { FinanceWeekSelect } from "@/components/dashboard/finance-week-select";
import { cn } from "@/lib/utils";

export type GuestPeriod = "day" | "week" | "month" | "all";

const PERIOD_OPTIONS: { value: GuestPeriod; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "all", label: "Histórico" },
];

export function GuestsPeriodFilter({
  period,
  periodLabel,
  selectedMonth,
  selectedDay,
  selectedWeek,
  monthOptions,
  dayOptions,
  weekOptions,
}: {
  period: GuestPeriod;
  periodLabel: string;
  selectedMonth: string;
  selectedDay: string;
  selectedWeek: string;
  monthOptions: { value: string; label: string }[];
  dayOptions: { value: string; label: string }[];
  weekOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setPeriod(next: GuestPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("guestPeriod");
    else params.set("guestPeriod", next);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/guests?${qs}` : "/dashboard/guests");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {period !== "all" ? (
          <FinanceMonthSelect
            value={selectedMonth}
            options={monthOptions}
            ariaLabel="Mes de estancias"
            className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
          />
        ) : null}
        {period === "day" ? (
          <FinanceDaySelect
            value={selectedDay}
            options={dayOptions}
            monthKey={selectedMonth}
            clearParams={["page"]}
          />
        ) : null}
        {period === "week" ? (
          <FinanceWeekSelect
            value={selectedWeek}
            options={weekOptions}
            monthKey={selectedMonth}
            clearParams={["page"]}
          />
        ) : null}
        <p className="text-sm capitalize text-text-muted">{periodLabel}</p>
      </div>
      <div
        className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
        role="group"
        aria-label="Periodo de estancias de huéspedes"
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
