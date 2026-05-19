"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { EXPENSE_CONCEPTS, EXPENSE_CONCEPT_LABELS } from "@/lib/expense-concepts";
import type { ExpenseConcept } from "@/types/domain";

type ExpenseCaptureFormProps = {
  action: (formData: FormData) => Promise<void>;
  returnTo?: string;
};

/** Stay under next.config serverActions.bodySizeLimit (10 MB) including other fields. */
const MAX_RECEIPT_BYTES = 9 * 1024 * 1024;

export function ExpenseCaptureForm({ action, returnTo = "/dashboard" }: ExpenseCaptureFormProps) {
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState<ExpenseConcept | "">("");
  const [conceptDetail, setConceptDetail] = useState("");
  const [receiptFileError, setReceiptFileError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const error = useMemo(() => {
    if (receiptFileError) return receiptFileError;
    if (!submitAttempted) return "";
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) return "Captura un monto mayor a cero.";
    if (!concept) return "Selecciona un concepto de gasto.";
    if (concept === "extras" && conceptDetail.trim().length < 3) {
      return "Para extras, describe el gasto (mínimo 3 caracteres).";
    }
    return "";
  }, [amount, concept, conceptDetail, receiptFileError, submitAttempted]);

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setReceiptFileError("");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setReceiptFileError("La foto es muy pesada (máx. 9 MB). Usa otra imagen o regístralo sin foto.");
      event.target.value = "";
      return;
    }
    setReceiptFileError("");
  }

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={() => setSubmitAttempted(true)}
      noValidate
    >
      <input type="hidden" name="return_to" value={returnTo} />
      {concept ? <input type="hidden" name="expense_concept" value={concept} /> : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-main">Concepto (un gasto por registro)</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {EXPENSE_CONCEPTS.map((value) => {
            const active = concept === value;
            return (
              <label
                key={value}
                className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors ${
                  active
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-border-soft text-text-main hover:bg-surface-soft"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={active}
                  onChange={() => setConcept(value)}
                  aria-label={EXPENSE_CONCEPT_LABELS[value]}
                />
                {EXPENSE_CONCEPT_LABELS[value]}
              </label>
            );
          })}
        </div>
      </fieldset>

      {concept === "extras" ? (
        <label className="flex flex-col gap-1 text-sm text-text-muted">
          Descripción del extra
          <input
            name="concept_detail"
            value={conceptDetail}
            onChange={(e) => setConceptDetail(e.target.value)}
            className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
            placeholder="Ej. compra de focos"
            required
          />
        </label>
      ) : (
        <input type="hidden" name="concept_detail" value="" />
      )}

      <AmountMethodFields amount={amount} onAmountChange={setAmount} />

      <label className="flex flex-col gap-1 text-sm text-text-muted">
        Foto del ticket o nota (opcional)
        <input
          name="receipt_image"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleReceiptChange}
          className="rounded-lg border border-border-soft px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-soft file:px-3 file:py-1"
        />
        <span className="text-xs text-text-muted">Máximo 9 MB. Si falla, registra sin foto.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text-muted">
        Notas adicionales (opcional)
        <input
          name="notes"
          className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
          placeholder="Detalle extra si hace falta"
        />
      </label>

      <Button type="submit" disabled={!concept || !!receiptFileError || (!!error && submitAttempted)}>
        Registrar gasto
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}

function AmountMethodFields({
  amount,
  onAmountChange,
}: {
  amount: string;
  onAmountChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm text-text-muted">
        Monto (MXN)
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main"
          placeholder="0.00"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-muted">
        Método de pago
        <select name="method" className="rounded-lg border border-border-soft px-3 py-2 text-sm text-text-main">
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
          <option value="card">Tarjeta</option>
        </select>
      </label>
    </div>
  );
}
