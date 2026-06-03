"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  financeMonthKeyToAnchorDate,
  formatMexicoCityMonthLabel,
  getMexicoCityDateString,
  getMexicoCityWeekBounds,
} from "@/lib/dates";
import type { DailyFinanceEntry, DailyFinanceGuestDetailsByDate } from "@/lib/day-finance";
import { FinanceDayDetailModal } from "@/components/dashboard/finance-day-detail-modal";

const INCOME_COLOR = "#1f8f4e";
const EXPENSE_COLOR = "#c53b3b";
const DAY_NAMES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

type FinanceCalendarViewProps = {
  entries: DailyFinanceEntry[];
  guestDetailsByDate: DailyFinanceGuestDetailsByDate;
  monthKey: string;
  highlightStart?: string;
  highlightEnd?: string;
  highlightDay?: string;
};

function formatCompactAmount(value: number) {
  if (value === 0) return "—";
  return `$${value.toFixed(0)}`;
}

export function FinanceCalendarView({
  entries,
  guestDetailsByDate,
  monthKey,
  highlightStart,
  highlightEnd,
  highlightDay,
}: FinanceCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = getMexicoCityDateString();
  const byDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);

  const selectedEntry = selectedDate
    ? (byDate.get(selectedDate) ?? {
        date: selectedDate,
        totalGuestIncome: 0,
        totalExpenses: 0,
        netResult: 0,
      })
    : null;
  const selectedGuestLines = selectedDate ? guestDetailsByDate[selectedDate] ?? [] : [];

  const [year, month] = monthKey.split("-").map(Number);
  const monthLabel = formatMexicoCityMonthLabel(financeMonthKeyToAnchorDate(monthKey));

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const grid: Array<{
      day: number;
      dateStr: string;
      inScope: boolean;
      entry: DailyFinanceEntry | null;
    }> = [];

    for (let i = 0; i < startDow; i++) {
      grid.push({ day: 0, dateStr: "", inScope: false, entry: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const inHighlightRange =
        highlightStart && highlightEnd
          ? dateStr >= highlightStart && dateStr <= highlightEnd
          : true;
      const inScope = highlightDay ? dateStr === highlightDay : inHighlightRange;

      grid.push({
        day,
        dateStr,
        inScope,
        entry: byDate.get(dateStr) ?? {
          date: dateStr,
          totalGuestIncome: 0,
          totalExpenses: 0,
          netResult: 0,
        },
      });
    }

    return grid;
  }, [byDate, highlightDay, highlightEnd, highlightStart, month, year]);

  return (
    <div className="rounded-lg border border-border-soft bg-surface-soft/30 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium capitalize text-text-main">{monthLabel}</p>
        <div className="flex flex-wrap gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: INCOME_COLOR }} />
            Ingresos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EXPENSE_COLOR }} />
            Gastos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-1 text-center text-[10px] font-medium text-text-muted">
            {name}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.dateStr) {
            return <div key={`empty-${index}`} />;
          }

          const { inScope } = cell;
          const entry =
            cell.entry ??
            ({
              date: cell.dateStr,
              totalGuestIncome: 0,
              totalExpenses: 0,
              netResult: 0,
            } satisfies DailyFinanceEntry);
          const hasMovement = entry.totalGuestIncome > 0 || entry.totalExpenses > 0;
          const isToday = cell.dateStr === today;

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={!inScope}
              onClick={() => inScope && setSelectedDate(cell.dateStr)}
              className={cn(
                "flex min-h-[4.5rem] flex-col rounded-md border px-1 py-1 text-left text-[10px] leading-tight transition",
                inScope
                  ? "cursor-pointer border-border-soft bg-white hover:border-brand-primary/40 hover:bg-surface-soft/50"
                  : "cursor-default border-transparent bg-surface-soft/40 opacity-45",
                isToday && inScope && "ring-1 ring-brand-primary/50",
                hasMovement && inScope && "border-brand-primary/20",
              )}
              title={
                inScope
                  ? `${cell.dateStr}: ingresos $${entry.totalGuestIncome.toFixed(2)}, gastos $${entry.totalExpenses.toFixed(2)}, neto $${entry.netResult.toFixed(2)}. Clic para detalle.`
                  : undefined
              }
            >
              <span
                className={cn(
                  "mb-0.5 font-semibold",
                  isToday && inScope ? "text-brand-primary" : "text-text-main",
                )}
              >
                {cell.day}
              </span>
              {inScope ? (
                <>
                  <span className="font-medium" style={{ color: INCOME_COLOR }}>
                    {formatCompactAmount(entry.totalGuestIncome)}
                  </span>
                  <span className="font-medium" style={{ color: EXPENSE_COLOR }}>
                    {formatCompactAmount(entry.totalExpenses)}
                  </span>
                  <span
                    className={cn(
                      "mt-auto font-semibold",
                      entry.netResult >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {entry.netResult === 0 ? "—" : formatCompactAmount(entry.netResult)}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>

      <FinanceDayDetailModal
        open={selectedDate != null}
        date={selectedDate}
        entry={selectedEntry}
        guestLines={selectedGuestLines}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}

export function getCalendarHighlightRange(
  period: "day" | "week" | "month",
  selectedDay: string,
  selectedWeek: string,
) {
  if (period === "day") {
    return { highlightDay: selectedDay };
  }
  if (period === "week") {
    const bounds = getMexicoCityWeekBounds(selectedWeek);
    return { highlightStart: bounds.start, highlightEnd: bounds.end };
  }
  return {};
}
