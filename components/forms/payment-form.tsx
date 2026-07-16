"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getMexicoCityDateString } from "@/lib/dates";

type PaymentFormProps = {
  action: (formData: FormData) => Promise<void>;
  folios: {
    id: string;
    folio_code: string;
    total_amount: number;
    balance_due: number;
  }[];
};

export function PaymentForm({ action, folios }: PaymentFormProps) {
  const [folioId, setFolioId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const error = useMemo(() => {
    if (!submitAttempted) return "";
    if (!folioId) return "Selecciona un folio.";
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) return "Monto inválido.";
    return "";
  }, [amount, folioId, submitAttempted]);

  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-6" onSubmit={() => setSubmitAttempted(true)} noValidate>
      <input type="hidden" name="return_to" value="/dashboard/payments" />
      <select
        name="folio_id"
        className="rounded-lg border border-border-soft px-3 py-2 text-sm md:col-span-2"
        required
        value={folioId}
        onChange={(e) => setFolioId(e.target.value)}
      >
        <option value="">Selecciona folio</option>
        {folios.map((folio) => (
          <option key={folio.id} value={folio.id}>
            {folio.folio_code} | Total {Number(folio.total_amount).toFixed(2)} | Saldo {Number(folio.balance_due).toFixed(2)}
          </option>
        ))}
      </select>
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Monto recibido"
        className="rounded-lg border border-border-soft px-3 py-2 text-sm"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select name="method" className="rounded-lg border border-border-soft px-3 py-2 text-sm">
        <option value="cash">Efectivo</option>
        <option value="transfer">Transferencia</option>
        <option value="card">Tarjeta</option>
      </select>
      <label className="grid gap-1 text-xs text-text-muted">
        Fecha efectiva
        <input
          name="effective_date"
          type="date"
          required
          max={getMexicoCityDateString()}
          defaultValue={getMexicoCityDateString()}
          className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
        />
      </label>
      <Button type="submit">Registrar pago</Button>
      <input
        name="notes"
        placeholder="Notas"
        className="rounded-lg border border-border-soft px-3 py-2 text-sm md:col-span-6"
      />
      <label className="md:col-span-6 flex items-center gap-2 rounded-lg border border-border-soft px-3 py-2 text-sm text-text-muted">
        <input type="checkbox" name="admin_override" className="h-4 w-4" />
        Admin override (requerido si hay diferencia contra esperado)
      </label>
      <input
        name="override_reason"
        placeholder="Motivo override (obligatorio cuando aplica)"
        className="rounded-lg border border-border-soft px-3 py-2 text-sm md:col-span-6"
      />
      {error ? <p className="md:col-span-6 text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
