"use client";

import { useState } from "react";
import Link from "next/link";
import { createExpenseResultAction } from "@/actions/operations";
import { ExpenseCaptureForm } from "@/components/forms/expense-capture-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ExpenseRegisterPanelProps = {
  returnTo?: string;
  hasOpenShift?: boolean;
  shiftLabel?: string;
  shiftExpenseTotal?: number;
  defaultOpen?: boolean;
};

export function ExpenseRegisterPanel({
  returnTo = "/dashboard",
  hasOpenShift = true,
  shiftLabel,
  shiftExpenseTotal,
  defaultOpen = false,
}: ExpenseRegisterPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-border-soft bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-text-main">Registrar gasto</h2>
            {hasOpenShift ? (
              <Badge variant="warning">Turno activo</Badge>
            ) : (
              <Badge variant="danger">Sin turno</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {!hasOpenShift
              ? "Inicia turno en Turnos para capturar egresos de este turno."
              : open
                ? shiftLabel
                  ? `${shiftLabel}. Un concepto por nota; puedes adjuntar foto del ticket.`
                  : "Un concepto por nota. Puedes guardar solo el monto o adjuntar foto del ticket."
                : shiftLabel
                  ? `${shiftLabel}. Toca para registrar un egreso del turno.`
                  : "Toca para registrar un gasto del turno."}
          </p>
          {hasOpenShift && shiftExpenseTotal != null ? (
            <p className="mt-1 text-sm font-medium text-text-main">
              Total egresos del turno: ${shiftExpenseTotal.toFixed(2)}
            </p>
          ) : null}
        </div>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="mt-4 rounded-xl border border-border-soft bg-surface-soft/60 p-4">
          {!hasOpenShift ? (
            <div className="space-y-3 text-sm text-text-muted">
              <p>Los egresos de recepción se registran dentro del turno abierto.</p>
              <Link href="/dashboard/shifts" className="inline-flex font-medium text-brand-primary hover:underline">
                Ir a Turnos para iniciar turno
              </Link>
            </div>
          ) : (
            <ExpenseCaptureForm
              action={createExpenseResultAction}
              returnTo={returnTo}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      ) : null}
    </Card>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-brand-primary transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
