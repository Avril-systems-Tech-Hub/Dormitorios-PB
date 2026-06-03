"use client";

import { useState } from "react";
import { PaymentForm } from "@/components/forms/payment-form";
import { Card } from "@/components/ui/card";

type PaymentRegisterPanelProps = {
  action: (formData: FormData) => Promise<void>;
  folios: {
    id: string;
    folio_code: string;
    total_amount: number;
    balance_due: number;
  }[];
};

export function PaymentRegisterPanel({ action, folios }: PaymentRegisterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-border-soft bg-surface-soft/40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-text-main">Cobro en caja</h2>
          <p className="mt-1 text-sm text-text-muted">
            {open
              ? "Registra un pago manual. El folio se liquida cuando el saldo llega a cero."
              : "Uso excepcional: registrar un pago desde administración."}
          </p>
        </div>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="mt-4 rounded-xl border border-border-soft bg-white p-4">
          <PaymentForm action={action} folios={folios} />
        </div>
      ) : null}
    </Card>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
