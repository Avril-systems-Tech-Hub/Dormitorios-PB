"use client";

import { useTransition } from "react";
import { resendPaymentReceiptAction } from "@/actions/operations";

type ResendReceiptButtonProps = {
  folioId: string;
  returnTo?: string;
  compact?: boolean;
};

export function ResendReceiptButton({ folioId, returnTo = "/dashboard", compact = false }: ResendReceiptButtonProps) {
  const [pending, startTransition] = useTransition();

  const handleResend = () => {
    startTransition(() => {
      const fd = new FormData();
      fd.set("folio_id", folioId);
      fd.set("return_to", returnTo);
      resendPaymentReceiptAction(fd);
    });
  };

  const className = compact
    ? "inline-flex w-full items-center justify-center gap-1 rounded bg-green-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-green-700 disabled:opacity-40"
    : "inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-40";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleResend}
      className={className}
      title="Reenviar comprobante por WhatsApp"
    >
      {pending ? (
        <>
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Enviando...
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {compact ? "Reenviar" : "Reenviar comprobante"}
        </>
      )}
    </button>
  );
}