"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FinanceDaySelect } from "@/components/dashboard/finance-day-select";
import { FinanceWeekSelect } from "@/components/dashboard/finance-week-select";
import {
  FinanceCalendarView,
  getCalendarHighlightRange,
} from "@/components/dashboard/finance-calendar-view";
import type {
  DailyFinanceEntry,
  DailyFinanceGuestDetailsByDate,
  DayFinanceSummary,
} from "@/lib/day-finance";
import { pieSlicePath } from "@/lib/pie-chart-path";

type ChartPeriod = "day" | "week" | "month";

type ReservationsFinanceChartProps = {
  day: DayFinanceSummary;
  week: DayFinanceSummary;
  month: DayFinanceSummary;
  monthLabel: string;
  dayLabel: string;
  weekLabel: string;
  selectedMonth: string;
  selectedDay: string;
  selectedWeek: string;
  dayOptions: { value: string; label: string }[];
  weekOptions: { value: string; label: string }[];
  dailyEntries: DailyFinanceEntry[];
  guestDetailsByDate: DailyFinanceGuestDetailsByDate;
};

type ChartSlice = {
  key: "income" | "expenses";
  label: string;
  value: number;
  color: string;
};

const PERIOD_OPTIONS: { value: ChartPeriod; label: string }[] = [
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

        return {
          ...slice,
          d: pieSlicePath(center, radius, start, end),
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
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0 sm:h-52 sm:w-52" role="img" aria-label="Distribución ingresos y gastos">
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
      <div className="flex h-48 items-end justify-center gap-4 px-2 sm:h-52 sm:gap-8 sm:px-4">
        {slices.map((slice) => {
          const heightPct = (slice.value / maxValue) * 100;
          return (
            <div key={slice.key} className="flex w-16 flex-col items-center gap-2 sm:w-24">
              <span className="text-xs font-medium text-text-main">${slice.value.toFixed(2)}</span>
              <div className="flex h-32 w-full items-end rounded-t-lg bg-surface-soft sm:h-40">
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

function getPeriodDescription(period: ChartPeriod, monthLabel: string, dayLabel: string, weekLabel: string) {
  if (period === "day") {
    return `Ingresos y gastos del ${dayLabel} · ${monthLabel}`;
  }
  if (period === "week") {
    return `Ingresos y gastos de la semana (${weekLabel}) · ${monthLabel}`;
  }
  return `Ingresos y gastos de ${monthLabel}`;
}

export function ReservationsFinanceChart({
  day,
  week,
  month,
  monthLabel,
  dayLabel,
  weekLabel,
  selectedMonth,
  selectedDay,
  selectedWeek,
  dayOptions,
  weekOptions,
  dailyEntries,
  guestDetailsByDate,
}: ReservationsFinanceChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>("month");
  const [view, setView] = useState<"pie" | "bar">("pie");
  const [showCalendar, setShowCalendar] = useState(false);

  const finance = period === "day" ? day : period === "week" ? week : month;
  const slices = buildSlices(finance);
  const calendarHighlight = getCalendarHighlightRange(period, selectedDay, selectedWeek);

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-main sm:text-lg">Estado financiero</h2>
          <p className="mt-1 text-sm capitalize text-text-muted">
            {getPeriodDescription(period, monthLabel, dayLabel, weekLabel)}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
          {period === "day" ? (
            <FinanceDaySelect
              value={selectedDay}
              options={dayOptions}
              monthKey={selectedMonth}
              className="w-full rounded-md border border-border-soft bg-white px-2 py-1.5 text-xs capitalize text-text-main sm:max-w-[12rem]"
            />
          ) : null}
          {period === "week" ? (
            <FinanceWeekSelect
              value={selectedWeek}
              options={weekOptions}
              monthKey={selectedMonth}
              className="w-full rounded-md border border-border-soft bg-white px-2 py-1.5 text-xs capitalize text-text-main sm:max-w-[12rem]"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <div className="mt-4">
        {view === "pie" ? <PieChart slices={slices} /> : <BarChart slices={slices} netResult={finance.netResult} />}
      </div>

      <div className="mt-4 border-t border-border-soft pt-3">
        <button
          type="button"
          onClick={() => setShowCalendar((open) => !open)}
          className="text-sm font-medium text-brand-primary underline-offset-2 hover:underline"
          aria-expanded={showCalendar}
        >
          {showCalendar ? "Ocultar calendario" : "Ver calendario"}
        </button>
        {showCalendar ? (
          <div className="mt-3">
            <FinanceCalendarView
              entries={dailyEntries}
              guestDetailsByDate={guestDetailsByDate}
              monthKey={selectedMonth}
              {...calendarHighlight}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
