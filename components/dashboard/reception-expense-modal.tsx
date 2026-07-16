"use client";

import { createExpenseResultAction } from "@/actions/operations";
import { ExpenseCaptureForm } from "@/components/forms/expense-capture-form";
import { Button } from "@/components/ui/button";

type ReceptionExpenseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftLabel: string;
  shiftExpenseTotal: number;
};

export function ReceptionExpenseModal({
  open,
  onOpenChange,
  shiftLabel,
  shiftExpenseTotal,
}: ReceptionExpenseModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-soft bg-white p-4 shadow-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reception-expense-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="reception-expense-title" className="text-lg font-semibold text-text-main">
              Registrar egreso
            </h2>
            <p className="mt-1 text-sm text-text-muted">{shiftLabel}</p>
            <p className="mt-1 text-sm font-medium text-text-main">
              Total egresos del turno: ${shiftExpenseTotal.toFixed(2)}
            </p>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
        <div className="mt-4">
          <ExpenseCaptureForm
            action={createExpenseResultAction}
            returnTo="/dashboard"
            onClose={() => onOpenChange(false)}
          />
        </div>
      </div>
    </div>
  );
}
