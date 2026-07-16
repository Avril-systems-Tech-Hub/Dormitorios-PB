"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reversePaymentAction } from "@/actions/operations";

export function PaymentCorrectionButton({
  paymentId,
  availableAmount,
}: {
  paymentId: string;
  availableAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(availableAmount));
  const [reason, setReason] = useState("");
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (availableAmount <= 0) {
    return <span className="text-xs text-text-muted">Compensado</span>;
  }

  function submit() {
    const numericAmount = Number(amount);
    if (numericAmount <= 0 || numericAmount > availableAmount || reason.trim().length < 5) {
      setMessage({
        type: "error",
        text: `Indica hasta $${availableAmount.toFixed(2)} y un motivo de al menos 5 caracteres.`,
      });
      return;
    }

    const formData = new FormData();
    formData.set("payment_id", paymentId);
    formData.set("amount", String(numericAmount));
    formData.set("reason", reason.trim());
    formData.set("submission_id", submissionId);

    startTransition(async () => {
      const result = await reversePaymentAction(formData);
      setMessage({ type: result.status, text: result.message });
      if (result.status === "success") {
        setOpen(false);
        setSubmissionId(crypto.randomUUID());
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
      >
        Corregir
      </button>
    );
  }

  return (
    <div className="min-w-48 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
      <label className="grid gap-1 text-xs text-amber-950">
        Monto a compensar
        <input
          type="number"
          min="0.01"
          max={availableAmount}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="h-8 rounded border border-amber-300 bg-white px-2 text-text-main"
        />
      </label>
      <label className="grid gap-1 text-xs text-amber-950">
        Motivo obligatorio
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-16 rounded border border-amber-300 bg-white px-2 py-1 text-text-main"
          placeholder="Ej. monto capturado incorrectamente"
        />
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded bg-amber-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Aplicando…" : "Aplicar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="rounded border border-amber-400 bg-white px-2 py-1 text-xs"
        >
          Cancelar
        </button>
      </div>
      {message ? (
        <p className={`text-xs ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
