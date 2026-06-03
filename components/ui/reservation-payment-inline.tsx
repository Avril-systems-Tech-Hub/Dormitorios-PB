"use client";

import { useTransition, useState } from "react";
import { registerPaymentAction } from "@/actions/operations";
import { ResendReceiptButton } from "@/components/ui/resend-receipt-button";

type PaymentMethod = "cash" | "transfer" | "card";

type ReservationPaymentInlineProps = {
  folioId: string;
  folioCode: string;
  balanceDue: number;
  totalAmount: number;
  paymentStatus: string;
  returnTo?: string;
};

/**
 * Inline payment widget for reservation rows.
 * Includes: amount input (limited to total), method selector, and pay button.
 */
export function ReservationPaymentInline({
  folioId,
  folioCode,
  balanceDue,
  totalAmount,
  paymentStatus,
  returnTo,
}: ReservationPaymentInlineProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (paymentStatus === "liquidated") {
    return (
      <div className="flex flex-col items-stretch gap-1">
        <span className="text-xs font-medium text-green-600">Pagado ✓</span>
        <ResendReceiptButton folioId={folioId} returnTo={returnTo} compact />
      </div>
    );
  }

  if (!balanceDue || balanceDue <= 0) {
    return <span className="text-xs text-gray-400">Sin saldo</span>;
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
    formData.set("notes", `Cobro desde dashboard - Folio ${folioCode}`);
    formData.set("return_to", "/dashboard");

    startTransition(async () => {
      try {
        await registerPaymentAction(formData);
        setMessage({ type: "success", text: "Pago registrado" });
        setAmount("");
      } catch (err) {
        if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.message === "NEXT_REDIRECT")) {
          setMessage({ type: "success", text: "Pago registrado" });
          setAmount("");
          return;
        }
        setMessage({ type: "error", text: "Error al registrar pago" });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full min-w-[8.5rem] flex-col gap-1.5">
      {/* Monto */}
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

      {/* Método */}
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
      >
        <option value="cash">Efectivo</option>
        <option value="transfer">Transferencia</option>
        <option value="card">Tarjeta</option>
      </select>

      {/* Botón Pagado */}
      <button
        type="submit"
        disabled={isPending || !numAmount || numAmount <= 0 || exceedsMax}
        className="w-full rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {isPending ? "Registrando..." : "Pagado"}
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