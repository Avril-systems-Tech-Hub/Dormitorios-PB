"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DayFinanceSummary } from "@/lib/day-finance";

type PaymentsExpensesComparisonProps = {
  summary: DayFinanceSummary;
  periodLabel: string;
  paymentCount: number;
  expenseCount: number;
};

type ChartSlice = {
  key: "income" | "expenses";
  label: string;
  value: number;
  color: string;
};

function buildSlices(finance: DayFinanceSummary): ChartSlice[] {
  return [
    { key: "income", label: "Pagos (ingresos)", value: finance.totalGuestIncome, color: "#1f8f4e" },
    { key: "expenses", label: "Gastos (egresos)", value: finance.totalExpenses, color: "#c53b3b" },
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
        Sin pagos ni gastos en este periodo
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
      <svg
        viewBox="0 0 200 200"
        className="h-52 w-52 shrink-0"
        role="img"
        aria-label="Comparación pagos y gastos"
      >
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
      <div className="flex h-52 items-end justify-center gap-10 px-4">
        {slices.map((slice) => {
          const heightPct = (slice.value / maxValue) * 100;
          return (
            <div key={slice.key} className="flex w-28 flex-col items-center gap-2">
              <span className="text-xs font-medium text-text-main">${slice.value.toFixed(2)}</span>
              <div className="flex h-40 w-full items-end rounded-t-lg bg-surface-soft">
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: slice.color,
                    minHeight: slice.value > 0 ? "4px" : "0",
                  }}
                />
              </div>
              <span className="text-center text-xs text-text-muted">{slice.label}</span>
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

export function PaymentsExpensesComparison({
  summary,
  periodLabel,
  paymentCount,
  expenseCount,
}: PaymentsExpensesComparisonProps) {
  const [view, setView] = useState<"pie" | "bar">("bar");
  const slices = buildSlices(summary);
  const expenseShare =
    summary.totalGuestIncome + summary.totalExpenses > 0
      ? (summary.totalExpenses / (summary.totalGuestIncome + summary.totalExpenses)) * 100
      : 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-main">Pagos vs gastos</h3>
          <p className="mt-0.5 text-sm capitalize text-text-muted">
            Ingresos por cobros frente a egresos operativos · {periodLabel}
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
          role="group"
          aria-label="Tipo de gráfica"
        >
          {(["bar", "pie"] as const).map((value) => (
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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card className="border-border-soft bg-surface-soft/40 p-3 shadow-none">
          <p className="text-xs text-text-muted">Pagos (ingresos)</p>
          <p className="mt-1 text-xl font-semibold text-text-main">
            ${summary.totalGuestIncome.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {paymentCount} cobro{paymentCount === 1 ? "" : "s"} en el periodo
          </p>
          <Link href="/dashboard/payments" className="mt-2 inline-block text-xs text-brand-primary underline">
            Ver pagos
          </Link>
        </Card>
        <Card className="border-border-soft bg-surface-soft/40 p-3 shadow-none">
          <p className="text-xs text-text-muted">Gastos (egresos)</p>
          <p className="mt-1 text-xl font-semibold text-text-main">${summary.totalExpenses.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {expenseCount} gasto{expenseCount === 1 ? "" : "s"} · {expenseShare.toFixed(0)}% del flujo
          </p>
          <Link href="/dashboard/expenses" className="mt-2 inline-block text-xs text-brand-primary underline">
            Ver gastos
          </Link>
        </Card>
        <Card className="border-border-soft bg-surface-soft/40 p-3 shadow-none">
          <p className="text-xs text-text-muted">Balance del periodo</p>
          <p className="mt-1 text-xl font-semibold text-text-main">${summary.netResult.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-text-muted">Pagos menos gastos operativos</p>
          <Badge variant={summary.netResult >= 0 ? "success" : "warning"} className="mt-2">
            {summary.netResult >= 0 ? "Superávit" : "Déficit"}
          </Badge>
        </Card>
      </div>

      <div className="mt-4">
        {view === "pie" ? (
          <PieChart slices={slices} />
        ) : (
          <BarChart slices={slices} netResult={summary.netResult} />
        )}
      </div>
    </Card>
  );
}
