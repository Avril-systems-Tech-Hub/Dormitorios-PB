"use client";

import { Button } from "@/components/ui/button";

type ReceptionPaymentToggleFormProps = {
  action: (formData: FormData) => Promise<void>;
  folioId: string;
};

export function ReceptionPaymentToggleForm({ action, folioId }: ReceptionPaymentToggleFormProps) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="return_to" value="/dashboard" />
      <input type="hidden" name="folio_id" value={folioId} />
      <label className="flex min-w-[122px] flex-col gap-1 text-xs text-text-muted">
        Método
        <select
          name="method"
          className="h-9 rounded-lg border border-border-soft bg-white px-2 text-sm text-text-main"
          required
        >
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
          <option value="card">Tarjeta</option>
        </select>
      </label>
      <Button type="submit" className="h-9 self-end">
        Pagado
      </Button>
      <input type="hidden" name="notes" value="Pago registrado desde dashboard recepción." />
    </form>
  );
}
