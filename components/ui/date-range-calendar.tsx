"use client";

import { useState } from "react";
import { DayButton, DayPicker } from "react-day-picker";
import type { DateRange, DayButtonProps } from "react-day-picker";
import { es } from "date-fns/locale/es";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function CalendarDayButton({
  className,
  modifiers,
  compact,
  ...props
}: DayButtonProps & { compact?: boolean }) {
  const isInRange =
    modifiers.selected ||
    modifiers.range_start ||
    modifiers.range_end ||
    modifiers.range_middle;

  return (
    <DayButton
      {...props}
      modifiers={modifiers}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-mkt-slate/25",
        compact ? "text-[10px]" : "text-[11px] sm:text-sm",
        isInRange && "font-bold text-white",
        !isInRange && "text-mkt-ink hover:bg-mkt-sky/50",
        className,
      )}
    />
  );
}

type DateRangeCalendarProps = {
  checkInDate: string;
  checkOutDate: string;
  onChange: (checkIn: string, checkOut: string) => void;
  minNights?: number;
  /** compact = tighter cells for narrow layouts */
  variant?: "default" | "compact";
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
  variant = "default",
}: DateRangeCalendarProps) {
  const compact = variant === "compact";
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

  const chevronClass = compact ? "h-3 w-3" : "h-3 w-3 sm:h-4 sm:w-4";
  const dateBoxClass = compact
    ? "min-w-0 flex-1 rounded-lg border border-mkt-border bg-white p-1.5 text-center"
    : "min-w-0 flex-1 rounded-xl border border-mkt-border bg-white p-2 text-center sm:p-3";
  const dateTextClass = compact
    ? "mt-0.5 text-[11px] font-bold text-mkt-slate"
    : "mt-0.5 text-xs font-bold text-mkt-slate sm:text-sm";

  return (
    <div className={cn("w-full space-y-3", compact && "mx-auto max-w-[18.5rem]")}>
      <div className={cn("flex items-center gap-2", compact ? "mb-2" : "mb-3")}>
        <div className={dateBoxClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mkt-terracotta">Entrada</p>
          <p className={dateTextClass}>
            {checkInDate
              ? new Date(checkInDate + "T12:00:00").toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </p>
        </div>
        <div className="shrink-0 text-white/50">
          <ChevronRight className={chevronClass} />
        </div>
        <div className={dateBoxClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mkt-terracotta">Salida</p>
          <p className={dateTextClass}>
            {checkOutDate
              ? new Date(checkOutDate + "T12:00:00").toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "rdp-wrapper rounded-xl border border-mkt-border bg-white",
          compact ? "mx-auto w-fit p-1.5" : "w-full p-2 sm:p-3",
        )}
      >
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={1}
          month={month}
          onMonthChange={setMonth}
          locale={es}
          disabled={{ before: today }}
          min={minNights}
          showOutsideDays
          captionLayout="label"
          style={{ width: compact ? "auto" : "100%" }}
          classNames={{
            root: compact ? "w-auto" : "w-full",
            months: "flex justify-center",
            month: cn(compact ? "w-auto space-y-0.5" : "w-full space-y-1"),
            month_caption: cn("flex items-center justify-between px-1", compact ? "py-0.5" : "py-1"),
            caption_label: cn(
              "font-semibold uppercase tracking-wide text-mkt-terracotta",
              compact ? "text-[10px]" : "text-xs sm:text-sm",
            ),
            nav: "flex items-center gap-1",
            button_previous: cn(
              "inline-flex items-center justify-center rounded-md border border-mkt-border bg-white text-mkt-slate transition hover:bg-mkt-sky/60",
              compact ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7",
            ),
            button_next: cn(
              "inline-flex items-center justify-center rounded-md border border-mkt-border bg-white text-mkt-slate transition hover:bg-mkt-sky/60",
              compact ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7",
            ),
            month_grid: compact ? "border-collapse" : "w-full border-collapse",
            weekdays: "grid grid-cols-7",
            weekday: cn(
              "text-center font-semibold uppercase tracking-wide text-mkt-terracotta",
              compact ? "w-8 text-[8px]" : "text-[9px] sm:text-[10px]",
            ),
            week: cn("grid grid-cols-7", compact ? "mt-0 gap-0.5" : "mt-0.5"),
            day: compact ? "h-8 w-8 p-0" : "aspect-square p-0",
            day_button: "",
            range_start: "rounded-l-md bg-mkt-slate",
            range_end: "rounded-r-md bg-mkt-slate",
            range_middle: "bg-mkt-slate",
            selected: "bg-mkt-slate font-bold",
            today: "font-bold text-mkt-slate ring-1 ring-mkt-slate/30 ring-inset",
            disabled: "text-mkt-ink-muted/40 opacity-50",
            outside: "text-mkt-ink-muted/35",
            hidden: "invisible",
          }}
          components={{
            DayButton: (props) => <CalendarDayButton {...props} compact={compact} />,
            Chevron: ({ orientation }) => {
              if (orientation === "left") return <ChevronLeft className={chevronClass} />;
              return <ChevronRight className={chevronClass} />;
            },
          }}
        />
      </div>

      {checkInDate && checkOutDate && (
        <p className={cn("text-center font-medium text-white/85", compact ? "mt-1 text-[10px]" : "mt-2 text-xs")}>
          {Math.max(
            1,
            Math.round(
              (new Date(checkOutDate + "T12:00:00").getTime() -
                new Date(checkInDate + "T12:00:00").getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )}{" "}
          noche(s) de estancia
        </p>
      )}
    </div>
  );
}
