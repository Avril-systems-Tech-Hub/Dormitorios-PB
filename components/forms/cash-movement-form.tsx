"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type CashMovementFormProps = {
  action: (formData: FormData) => Promise<void>;
};

export function CashMovementForm({ action }: CashMovementFormProps) {
  const [amount, setAmount] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const error = useMemo(() => {
    if (!submitAttempted) return "";
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) return "Monto inválido (debe ser mayor a 0).";
    return "";
  }, [amount, submitAttempted]);

  return (
    <form action={action} className="grid flex-1 gap-2 md:grid-cols-5" onSubmit={() => setSubmitAttempted(true)} noValidate>
      <input type="hidden" name="return_to" value="/dashboard/cash-cuts" />
      <select name="direction" className="rounded-lg border border-border-soft px-3 py-2 text-sm">
        <option value="income">Ingreso</option>
        <option value="expense">Egreso</option>
      </select>
      <select name="category" className="rounded-lg border border-border-soft px-3 py-2 text-sm">
        <option value="sale">Venta</option>
        <option value="gasto_operativo">Gasto operativo</option>
        <option value="gasto_administrativo">Gasto administrativo</option>
        <option value="gasto_cubrir_dias">Gasto cubrir días</option>
        <option value="contadora">Contadora</option>
        <option value="other">Otro</option>
      </select>
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0"
        required
        className="rounded-lg border border-border-soft px-3 py-2 text-sm"
        placeholder="Monto"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        name="notes"
        className="rounded-lg border border-border-soft px-3 py-2 text-sm"
        placeholder="Notas"
      />
      <Button type="submit" variant="outline">
        Registrar movimiento
      </Button>
      {error ? <p className="md:col-span-5 text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
