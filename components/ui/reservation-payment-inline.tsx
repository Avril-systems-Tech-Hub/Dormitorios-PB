"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { registerPaymentResultAction } from "@/actions/operations";
import { ResendReceiptButton } from "@/components/ui/resend-receipt-button";
import { getMexicoCityDateString } from "@/lib/dates";

type PaymentMethod = "cash" | "transfer" | "card";

type ReservationPaymentInlineProps = {
  folioId: string;
  folioCode: string;
  balanceDue: number;
  totalAmount: number;
  paidAmount?: number;
  paymentStatus: string;
  returnTo?: string;
};

function PaymentBreakdown({
  totalAmount,
  paidAmount,
  balanceDue,
}: {
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}) {
  return (
    <p className="text-[10px] leading-snug tabular-nums text-text-main">
      <span className="text-text-muted">Total</span> ${totalAmount.toFixed(2)}
      <span className="text-text-muted"> · </span>
      <span className="text-text-muted">Pagado</span> ${paidAmount.toFixed(2)}
      <span className="text-text-muted"> · </span>
      <span className={balanceDue > 0 ? "font-medium text-amber-800" : "text-text-muted"}>
        Pendiente
      </span>{" "}
      <span className={balanceDue > 0 ? "font-medium text-amber-800" : "text-text-muted"}>
        ${balanceDue.toFixed(2)}
      </span>
    </p>
  );
}

/**
 * Inline payment widget for reservation rows.
 * Includes: amount input (limited to total), method selector, and pay button.
 */
export function ReservationPaymentInline({
  folioId,
  folioCode,
  balanceDue,
  totalAmount,
  paidAmount,
  paymentStatus,
  returnTo,
}: ReservationPaymentInlineProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [effectiveDate, setEffectiveDate] = useState(getMexicoCityDateString());
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const resolvedPaid =
    paidAmount != null ? paidAmount : Math.max(0, Number((totalAmount - balanceDue).toFixed(2)));

  if (paymentStatus === "liquidated") {
    return (
      <div className="flex flex-col items-stretch gap-1">
        <span className="text-xs font-medium text-green-600">Pagado ✓</span>
        <PaymentBreakdown
          totalAmount={totalAmount}
          paidAmount={resolvedPaid > 0 ? resolvedPaid : totalAmount}
          balanceDue={0}
        />
        <ResendReceiptButton folioId={folioId} returnTo={returnTo} compact />
      </div>
    );
  }

  if (!balanceDue || balanceDue <= 0) {
    return (
      <div className="flex flex-col gap-1">
        <PaymentBreakdown
          totalAmount={totalAmount}
          paidAmount={resolvedPaid}
          balanceDue={0}
        />
        <span className="text-xs text-gray-400">Sin pendiente</span>
      </div>
    );
  }

  const numAmount = Number(amount) || 0;
  const maxPayable = balanceDue > 0 ? balanceDue : totalAmount;
  const exceedsMax = numAmount > maxPayable;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0 || exceedsMax) return;

    setMessage(null);
    const formData = new FormData();
    formData.set("folio_id", folioId);
    formData.set("amount", String(numAmount));
    formData.set("method", method);
    formData.set("effective_date", effectiveDate);
    formData.set("notes", notes || `Cobro desde listado - Folio ${folioCode}`);
    formData.set("return_to", returnTo ?? "/dashboard/reservations");

    startTransition(async () => {
      try {
        const result = await registerPaymentResultAction(formData);
        setMessage({ type: result.status, text: result.message });
        if (result.status === "success") {
          setAmount("");
          router.refresh();
        }
      } catch (err) {
        console.error("[ReservationPaymentInline] payment failed:", err);
        setMessage({ type: "error", text: "Error al registrar pago" });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full min-w-[8.5rem] flex-col gap-1.5">
      <PaymentBreakdown
        totalAmount={totalAmount}
        paidAmount={resolvedPaid}
        balanceDue={balanceDue}
      />
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">$</span>
        <input
          type="number"
          min={1}
          max={maxPayable}
          step={0.01}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setMessage(null);
          }}
          placeholder="Monto"
          className={`min-w-0 flex-1 rounded border px-2 py-1.5 text-xs sm:max-w-[5.5rem] sm:flex-none sm:py-1 ${
            exceedsMax
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-gray-300 bg-white text-gray-900"
          }`}
        />
      </div>
      {exceedsMax && (
        <span className="text-[10px] text-red-500">Máx ${maxPayable.toFixed(2)}</span>
      )}

      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
      >
        <option value="cash">Efectivo</option>
        <option value="transfer">Transferencia</option>
        <option value="card">Tarjeta</option>
      </select>

      <input
        type="date"
        value={effectiveDate}
        max={getMexicoCityDateString()}
        onChange={(e) => setEffectiveDate(e.target.value)}
        aria-label="Fecha efectiva del pago"
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        aria-label="Notas del pago"
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
      />

      <button
        type="submit"
        disabled={isPending || !numAmount || numAmount <= 0 || exceedsMax || !effectiveDate}
        className="w-full rounded bg-brand-primary px-2 py-1 text-xs font-medium text-white hover:bg-brand-secondary disabled:opacity-40"
      >
        {isPending
          ? "Registrando..."
          : numAmount > 0 && numAmount >= maxPayable
            ? "Registrar pago y WhatsApp"
            : "Registrar pago"}
      </button>

      {message && (
        <span
          className={`text-[10px] ${
            message.type === "success" ? "text-green-600" : "text-red-500"
          }`}
        >
          {message.text}
        </span>
      )}
    </form>
  );
}
