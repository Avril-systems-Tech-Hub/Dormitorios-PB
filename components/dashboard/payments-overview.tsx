"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FinanceDaySelect } from "@/components/dashboard/finance-day-select";
import { FinanceMonthSelect } from "@/components/dashboard/finance-month-select";
import { FinanceWeekSelect } from "@/components/dashboard/finance-week-select";
import { cn } from "@/lib/utils";
import {
  FOLIO_SUMMARY_FILTERS,
  parseFolioSummaryFilter,
  type FolioSummaryFilter,
} from "@/lib/folio-summary";
import {
  PAYMENT_METHOD_LABELS,
  parsePayPeriod,
  parseShiftOperatorFilter,
  type OpenFolioStats,
  type PayPeriod,
  type PaymentPeriodStats,
  type ShiftOperatorFilter,
} from "@/lib/payment-insights";

type PaymentsOverviewProps = {
  payPeriod: PayPeriod;
  periodLabel: string;
  selectedMonth: string;
  selectedDay: string;
  selectedWeek: string;
  monthOptions: { value: string; label: string }[];
  dayOptions: { value: string; label: string }[];
  weekOptions: { value: string; label: string }[];
  periodStats: PaymentPeriodStats;
  openFolioStats: OpenFolioStats;
  folioFilter: FolioSummaryFilter;
  shiftFilter: ShiftOperatorFilter;
  shiftOptions: { value: string; label: string }[];
  paidFolioCount: number;
};

const PERIOD_OPTIONS: { value: PayPeriod; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

function clearStaleTableParams(params: URLSearchParams) {
  params.delete("payView");
  params.delete("sort");
  params.delete("dir");
  for (const key of [...params.keys()]) {
    if (key.startsWith("cf_")) params.delete(key);
  }
}

export function PaymentsOverview({
  payPeriod,
  periodLabel,
  selectedMonth,
  selectedDay,
  selectedWeek,
  monthOptions,
  dayOptions,
  weekOptions,
  periodStats,
  openFolioStats,
  folioFilter,
  shiftFilter,
  shiftOptions,
  paidFolioCount,
}: PaymentsOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setPayPeriod = (next: PayPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "month") {
      params.delete("payPeriod");
    } else {
      params.set("payPeriod", next);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/payments?${qs}` : "/dashboard/payments");
  };

  const setFolioFilter = (next: FolioSummaryFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    clearStaleTableParams(params);
    if (next === "por_pagar") {
      params.delete("folioFilter");
      params.delete("shiftOp");
    } else {
      params.set("folioFilter", next);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/payments?${qs}` : "/dashboard/payments");
  };

  const setShiftFilter = (next: ShiftOperatorFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("shiftOp");
    } else {
      params.set("shiftOp", next);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/payments?${qs}` : "/dashboard/payments");
  };

  const activeFilter = parseFolioSummaryFilter(searchParams.get("folioFilter") ?? folioFilter);
  const activePeriod = parsePayPeriod(searchParams.get("payPeriod") ?? payPeriod);
  const activeShift = parseShiftOperatorFilter(searchParams.get("shiftOp") ?? shiftFilter);
  const showShiftFilter = activeFilter !== "por_pagar" && shiftOptions.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-main">Resumen de pagos</h2>
            <p className="mt-1 text-sm capitalize text-text-muted">{periodLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FinanceMonthSelect
              value={selectedMonth}
              options={monthOptions}
              className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
            />
            {activePeriod === "day" ? (
              <FinanceDaySelect
                value={selectedDay}
                options={dayOptions}
                monthKey={selectedMonth}
                className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
              />
            ) : null}
            {activePeriod === "week" ? (
              <FinanceWeekSelect
                value={selectedWeek}
                options={weekOptions}
                monthKey={selectedMonth}
                className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
              />
            ) : null}
            <div
              className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
              role="group"
              aria-label="Periodo de pagos"
            >
              {PERIOD_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPayPeriod(value)}
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
            label="Cobrado en periodo"
            value={`$${periodStats.totalCollected.toFixed(2)}`}
            hint={`${periodStats.transactionCount} transacciones`}
            badge="Ingresos"
            badgeVariant="success"
          />
          <StatCard
            label="Saldo pendiente"
            value={`$${openFolioStats.totalBalance.toFixed(2)}`}
            hint={`${openFolioStats.count} folios con saldo`}
            badge="Por cobrar"
            badgeVariant="warning"
          />
          <StatCard
            label="Folios liquidados"
            value={String(paidFolioCount)}
            hint="Histórico total"
            badge="Pagados"
            badgeVariant="success"
          />
          <Card className="border-border-soft bg-surface-soft/50 p-3 shadow-none">
            <p className="text-xs text-text-muted">Por método (periodo)</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(Object.keys(PAYMENT_METHOD_LABELS) as (keyof typeof PAYMENT_METHOD_LABELS)[]).map(
                (method) => (
                  <li key={method} className="flex items-center justify-between gap-2">
                    <span className="text-text-muted">{PAYMENT_METHOD_LABELS[method]}</span>
                    <span className="font-medium text-text-main">
                      ${periodStats.byMethod[method].toFixed(2)}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </Card>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-main">
            {activeFilter === "por_pagar" ? "Folios por pagar" : "Registro de cobros"}
          </h3>
          <p className="mt-0.5 text-sm text-text-muted">
            {activeFilter === "por_pagar"
              ? "Todos los folios con saldo pendiente (coincide con el KPI de arriba). Haz clic en Saldo para ordenar."
              : activeFilter === "pagados"
                ? "Pagos del periodo en folios ya liquidados. Filtra por turno del operador. Haz clic en Monto para ordenar."
                : "Todos los pagos del periodo seleccionado. Filtra por turno del operador. Haz clic en Monto para ordenar."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showShiftFilter ? (
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <span className="whitespace-nowrap font-medium">Turno</span>
              <select
                value={activeShift}
                onChange={(event) => setShiftFilter(parseShiftOperatorFilter(event.target.value))}
                className="max-w-[12rem] rounded-md border border-border-soft bg-white px-2 py-1.5 text-xs font-medium text-text-main"
                aria-label="Filtrar cobros por turno"
              >
                <option value="all">Todos los turnos</option>
                {shiftOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div
            className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
            role="group"
            aria-label="Estado del folio"
          >
            {FOLIO_SUMMARY_FILTERS.map(({ value, toggleLabel }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFolioFilter(value)}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  activeFilter === value
                    ? "bg-white text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main",
                )}
              >
                {toggleLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
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
