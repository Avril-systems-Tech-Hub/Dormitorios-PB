"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ReceptionPaymentToggleFormProps = {
  action: (formData: FormData) => Promise<void>;
  folioId: string;
};

export function ReceptionPaymentToggleForm({ action, folioId }: ReceptionPaymentToggleFormProps) {
  const [paymentState, setPaymentState] = useState("not_paid");

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="return_to" value="/dashboard" />
      <input type="hidden" name="folio_id" value={folioId} />
      <label className="flex min-w-[108px] flex-col gap-1 text-xs text-text-muted">
        Pago
        <select
          name="payment_state"
          value={paymentState}
          onChange={(e) => setPaymentState(e.target.value)}
          className="h-9 rounded-lg border border-border-soft bg-white px-2 text-sm text-text-main"
        >
          <option value="not_paid">No pagada</option>
          <option value="paid">Pagada</option>
        </select>
      </label>
      <label className="flex w-[120px] flex-col gap-1 text-xs text-text-muted">
        Monto
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          placeholder={paymentState === "paid" ? "Monto requerido" : "Opcional"}
          required={paymentState === "paid"}
          className="h-9 rounded-lg border border-border-soft bg-white px-2 text-sm text-text-main"
        />
      </label>
      <label className="flex min-w-[122px] flex-col gap-1 text-xs text-text-muted">
        Método
        <select
          name="method"
          className="h-9 rounded-lg border border-border-soft bg-white px-2 text-sm text-text-main"
          required={paymentState === "paid"}
        >
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
          <option value="card">Tarjeta</option>
        </select>
      </label>
      <Button type="submit" className="h-9 self-end">
        Aplicar
      </Button>
      <input type="hidden" name="notes" value="Pago registrado desde dashboard recepción." />
    </form>
  );
}
