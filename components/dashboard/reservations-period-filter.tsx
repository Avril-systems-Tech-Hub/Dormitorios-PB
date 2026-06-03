"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
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
  monthOptions,
}: {
  period: ReservationPeriod;
  periodLabel: string;
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setPeriod(next: ReservationPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/reservations?${qs}` : "/dashboard/reservations");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {period === "month" ? (
        <FinanceMonthSelect
          value={selectedMonth}
          options={monthOptions}
          ariaLabel="Mes de reservaciones"
          className="rounded-md border border-border-soft bg-white px-2 py-1 text-sm capitalize text-text-main"
        />
      ) : (
        <p className="text-sm capitalize text-text-muted">{periodLabel}</p>
      )}
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
