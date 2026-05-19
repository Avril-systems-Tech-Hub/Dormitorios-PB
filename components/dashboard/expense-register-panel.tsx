"use client";

import { useState } from "react";
import { createExpenseAction } from "@/actions/operations";
import { ExpenseCaptureForm } from "@/components/forms/expense-capture-form";
import { Card } from "@/components/ui/card";

type ExpenseRegisterPanelProps = {
  returnTo?: string;
};

export function ExpenseRegisterPanel({ returnTo = "/dashboard" }: ExpenseRegisterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-brand-primary/30 bg-brand-primary/5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-text-main">Registrar gasto</h2>
          <p className="mt-1 text-sm text-text-muted">
            {open
              ? "Un concepto por nota. Puedes guardar solo el monto o adjuntar foto del ticket."
              : "Toca para registrar un gasto del turno."}
          </p>
        </div>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="mt-4 rounded-xl border border-border-soft bg-white p-4">
          <ExpenseCaptureForm action={createExpenseAction} returnTo={returnTo} />
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
