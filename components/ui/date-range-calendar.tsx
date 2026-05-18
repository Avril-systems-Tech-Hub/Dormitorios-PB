"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import { es } from "date-fns/locale/es";
import { ChevronLeft, ChevronRight } from "lucide-react";

type DateRangeCalendarProps = {
  checkInDate: string;
  checkOutDate: string;
  onChange: (checkIn: string, checkOut: string) => void;
  minNights?: number;
};

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DateRangeCalendar({
  checkInDate,
  checkOutDate,
  onChange,
  minNights = 1,
}: DateRangeCalendarProps) {
  const [month, setMonth] = useState(() => {
    if (checkInDate) return new Date(checkInDate + "T12:00:00");
    return new Date();
  });

  const selected: DateRange | undefined = checkInDate
    ? {
        from: new Date(checkInDate + "T12:00:00"),
        to: checkOutDate ? new Date(checkOutDate + "T12:00:00") : undefined,
      }
    : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onChange("", "");
      return;
    }
    const from = formatDate(range.from);
    const to = range.to ? formatDate(range.to) : "";
    onChange(from, to);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="w-full max-w-full space-y-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-xl border border-mkt-border bg-white p-2 text-center sm:p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mkt-terracotta">Entrada</p>
          <p className="mt-0.5 text-xs font-bold text-mkt-slate sm:text-sm">
            {checkInDate
              ? new Date(checkInDate + "T12:00:00").toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </p>
        </div>
        <div className="flex-shrink-0 text-white/50">
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        </div>
        <div className="min-w-0 flex-1 rounded-xl border border-mkt-border bg-white p-2 text-center sm:p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mkt-terracotta">Salida</p>
          <p className="mt-0.5 text-xs font-bold text-mkt-slate sm:text-sm">
            {checkOutDate
              ? new Date(checkOutDate + "T12:00:00").toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </p>
        </div>
      </div>

      <div className="rdp-wrapper w-full rounded-xl border border-mkt-border bg-white p-2 sm:p-3">
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={1}
          month={month}
          onMonthChange={setMonth}
          locale={es}
          disabled={{ before: today }}
          min={minNights + 1}
          showOutsideDays
          captionLayout="label"
          style={{ width: "100%" }}
          classNames={{
            root: "w-full",
            months: "flex w-full justify-center",
            month: "w-full space-y-1",
            month_caption: "flex items-center justify-between px-1 py-1",
            caption_label: "text-xs font-semibold uppercase tracking-wide text-mkt-terracotta sm:text-sm",
            nav: "flex items-center gap-1",
            button_previous:
              "inline-flex h-6 w-6 items-center justify-center rounded-md border border-mkt-border bg-white text-mkt-slate transition hover:bg-mkt-sky/60 sm:h-7 sm:w-7",
            button_next:
              "inline-flex h-6 w-6 items-center justify-center rounded-md border border-mkt-border bg-white text-mkt-slate transition hover:bg-mkt-sky/60 sm:h-7 sm:w-7",
            month_grid: "w-full border-collapse",
            weekdays: "grid grid-cols-7",
            weekday:
              "text-center text-[9px] font-semibold uppercase tracking-wide text-mkt-terracotta sm:text-[10px]",
            week: "grid grid-cols-7 mt-0.5",
            day: "aspect-square p-0",
            day_button:
              "h-full w-full flex items-center justify-center rounded-md text-[11px] text-mkt-ink transition-colors hover:bg-mkt-sky/50 focus:outline-none focus:ring-2 focus:ring-mkt-slate/25 sm:text-sm",
            range_start: "bg-mkt-slate text-white rounded-l-md",
            range_end: "bg-mkt-slate text-white rounded-r-md",
            range_middle: "bg-mkt-sky/70 text-mkt-slate-deep",
            selected: "!bg-mkt-slate text-white font-bold",
            today: "font-bold text-mkt-slate ring-1 ring-mkt-slate/30 ring-inset",
            disabled: "text-mkt-ink-muted/40 opacity-50",
            outside: "text-mkt-ink-muted/35",
            hidden: "invisible",
          }}
          components={{
            Chevron: ({ orientation }) => {
              if (orientation === "left") return <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />;
              return <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />;
            },
          }}
        />
      </div>

      {checkInDate && checkOutDate && (
        <p className="mt-2 text-center text-xs font-medium text-white/85">
          {Math.max(
            1,
            Math.round(
              (new Date(checkOutDate + "T12:00:00").getTime() -
                new Date(checkInDate + "T12:00:00").getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )}{" "}
          noche(s) de estancia
        </p>
      )}
    </div>
  );
}
