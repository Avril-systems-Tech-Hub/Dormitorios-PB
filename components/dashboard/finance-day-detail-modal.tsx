"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMexicoCityDate, formatMexicoCityDayLabel } from "@/lib/dates";
import type { DailyFinanceEntry, DayFinanceGuestLine } from "@/lib/day-finance";

const INCOME_COLOR = "#1f8f4e";
const EXPENSE_COLOR = "#c53b3b";

function formatShortStayDate(isoDate: string) {
  if (!isoDate) return "—";
  return formatMexicoCityDate(isoDate, {
    day: "numeric",
    month: "short",
  });
}

function formatStaySummary(line: DayFinanceGuestLine) {
  const range =
    line.checkIn && line.checkOut
      ? `${formatShortStayDate(line.checkIn)} – ${formatShortStayDate(line.checkOut)}`
      : null;
  const nightsLabel = `${line.nights} noche${line.nights === 1 ? "" : "s"}`;
  return range ? `${nightsLabel} · ${range}` : nightsLabel;
}

type FinanceDayDetailModalProps = {
  open: boolean;
  date: string | null;
  entry: DailyFinanceEntry | null;
  guestLines: DayFinanceGuestLine[];
  onClose: () => void;
};

export function FinanceDayDetailModal({
  open,
  date,
  entry,
  guestLines,
  onClose,
}: FinanceDayDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !date || !entry) return null;

  const title = formatMexicoCityDayLabel(date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-day-detail-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-soft px-4 py-3">
          <h3 id="finance-day-detail-title" className="text-lg font-semibold capitalize text-text-main">
            {title}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-border-soft bg-surface-soft/40 px-4 py-3 text-center text-sm">
          <div>
            <p className="text-xs text-text-muted">Ingresos</p>
            <p className="mt-0.5 font-semibold" style={{ color: INCOME_COLOR }}>
              ${entry.totalGuestIncome.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Egresos</p>
            <p className="mt-0.5 font-semibold" style={{ color: EXPENSE_COLOR }}>
              ${entry.totalExpenses.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Neto</p>
            <p
              className={cn(
                "mt-0.5 font-semibold",
                entry.netResult >= 0 ? "text-success" : "text-danger",
              )}
            >
              ${entry.netResult.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Cobros del día
          </p>
          {guestLines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-soft px-3 py-6 text-center text-sm text-text-muted">
              Sin cobros registrados este día.
            </p>
          ) : (
            <ul className="space-y-2">
              {guestLines.map((line) => (
                <li
                  key={line.folioCode}
                  className="rounded-lg border border-border-soft bg-surface-soft/30 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-text-main">
                        {line.guestNames.length > 0
                          ? line.guestNames.join(", ")
                          : "Huésped sin nombre"}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">{formatStaySummary(line)}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-muted">{line.folioCode}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold" style={{ color: INCOME_COLOR }}>
                      ${line.paidAmount.toFixed(2)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border-soft px-4 py-3">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
