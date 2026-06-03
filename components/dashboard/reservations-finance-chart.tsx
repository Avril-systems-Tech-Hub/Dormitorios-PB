"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import type { DayFinanceSummary } from "@/lib/day-finance";
import type { ReservationPeriod } from "@/lib/dates";

type ReservationsFinanceChartProps = {
  day: DayFinanceSummary;
  week: DayFinanceSummary;
  month: DayFinanceSummary;
  weekLabel: string;
  monthLabel: string;
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
};

type ChartSlice = {
  key: "income" | "expenses";
  label: string;
  value: number;
  color: string;
};

const PERIOD_OPTIONS: { value: ReservationPeriod; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

function buildSlices(finance: DayFinanceSummary): ChartSlice[] {
  return [
    { key: "income", label: "Ingresos", value: finance.totalGuestIncome, color: "#1f8f4e" },
    { key: "expenses", label: "Gastos", value: finance.totalExpenses, color: "#c53b3b" },
  ];
}

function PieChart({ slices }: { slices: ChartSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 88;
  const center = 100;

  const segments = useMemo(() => {
    if (total <= 0) return [];

    let cursor = -Math.PI / 2;
    return slices
      .filter((slice) => slice.value > 0)
      .map((slice) => {
        const angle = (slice.value / total) * Math.PI * 2;
        const start = cursor;
        const end = cursor + angle;
        cursor = end;

        const x1 = center + radius * Math.cos(start);
        const y1 = center + radius * Math.sin(start);
        const x2 = center + radius * Math.cos(end);
        const y2 = center + radius * Math.sin(end);
        const largeArc = angle > Math.PI ? 1 : 0;

        return {
          ...slice,
          d: `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
          pct: (slice.value / total) * 100,
        };
      });
  }, [slices, total]);

  if (total <= 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border-soft bg-surface-soft/50 text-sm text-text-muted">
        Sin movimientos en este periodo
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
      <svg viewBox="0 0 200 200" className="h-52 w-52 shrink-0" role="img" aria-label="Distribución ingresos y gastos">
        {segments.map((segment) => (
          <path key={segment.key} d={segment.d} fill={segment.color} />
        ))}
        <circle cx={center} cy={center} r={42} fill="white" />
        <text x={center} y={96} textAnchor="middle" className="fill-text-main text-[11px] font-semibold">
          Total
        </text>
        <text x={center} y={112} textAnchor="middle" className="fill-text-muted text-[10px]">
          ${total.toFixed(0)}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-text-main">
              {segment.label}: <span className="font-medium">${segment.value.toFixed(2)}</span>
            </span>
            <span className="text-text-muted">({segment.pct.toFixed(1)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({ slices, netResult }: { slices: ChartSlice[]; netResult: number }) {
  const maxValue = Math.max(...slices.map((slice) => slice.value), 1);

  return (
    <div className="space-y-4">
      <div className="flex h-52 items-end justify-center gap-8 px-4">
        {slices.map((slice) => {
          const heightPct = (slice.value / maxValue) * 100;
          return (
            <div key={slice.key} className="flex w-24 flex-col items-center gap-2">
              <span className="text-xs font-medium text-text-main">${slice.value.toFixed(2)}</span>
              <div className="flex h-40 w-full items-end rounded-t-lg bg-surface-soft">
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{ height: `${heightPct}%`, backgroundColor: slice.color, minHeight: slice.value > 0 ? "4px" : "0" }}
                />
              </div>
              <span className="text-xs text-text-muted">{slice.label}</span>
            </div>
          );
        })}
      </div>
      <p className="text-center text-sm text-text-muted">
        Resultado neto:{" "}
        <span className={cn("font-semibold", netResult >= 0 ? "text-success" : "text-danger")}>
          ${netResult.toFixed(2)}
        </span>
      </p>
    </div>
  );
}

function getPeriodDescription(period: ReservationPeriod, weekLabel: string, monthLabel: string) {
  if (period === "day") return "Ingresos y gastos del día";
  if (period === "week") return `Ingresos y gastos de la semana (${weekLabel})`;
  return `Ingresos y gastos de ${monthLabel}`;
}

export function ReservationsFinanceChart({
  day,
  week,
  month,
  weekLabel,
  monthLabel,
  selectedMonth,
  monthOptions,
}: ReservationsFinanceChartProps) {
  const [period, setPeriod] = useState<ReservationPeriod>("day");
  const [view, setView] = useState<"pie" | "bar">("pie");

  const finance = period === "day" ? day : period === "week" ? week : month;
  const slices = buildSlices(finance);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-main">Estado financiero</h2>
          <p className="mt-1 text-sm text-text-muted">
            {getPeriodDescription(period, weekLabel, monthLabel)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {period === "month" ? (
            <FinanceMonthSelect
              value={selectedMonth}
              options={monthOptions}
              className="rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
            />
          ) : null}
          <div
            className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
            role="group"
            aria-label="Periodo"
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
          <div
            className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
            role="group"
            aria-label="Tipo de gráfica"
          >
            {(["pie", "bar"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  view === value
                    ? "bg-white text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main",
                )}
              >
                {value === "pie" ? "Pastel" : "Barras"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {view === "pie" ? <PieChart slices={slices} /> : <BarChart slices={slices} netResult={finance.netResult} />}
      </div>
    </Card>
  );
}
