import { createExpenseAction } from "@/actions/operations";
import { ExpenseCaptureForm } from "@/components/forms/expense-capture-form";
import { Card } from "@/components/ui/card";

export function ReceptionExpensePanel() {
  return (
    <Card className="border-brand-primary/30 bg-brand-primary/5">
      <h2 className="text-base font-semibold text-text-main">Registrar gasto</h2>
      <p className="mt-1 text-sm text-text-muted">
        Un concepto por nota. Puedes guardar solo el monto o adjuntar foto del ticket.
      </p>
      <div className="mt-4 rounded-xl border border-border-soft bg-white p-4">
        <ExpenseCaptureForm action={createExpenseAction} returnTo="/dashboard" />
      </div>
    </Card>
  );
}
