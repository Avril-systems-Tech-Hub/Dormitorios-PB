"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerCheckoutAction } from "@/actions/operations";

export function RegisterCheckoutButton({
  reservationId,
  balanceDue = 0,
  compact = false,
}: {
  reservationId: string;
  balanceDue?: number;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function registerCheckout() {
    const debtNotice =
      balanceDue > 0
        ? ` El saldo pendiente de $${balanceDue.toFixed(2)} permanecerá en el folio.`
        : "";
    if (!window.confirm(`¿Registrar la salida y liberar la cama?${debtNotice}`)) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("reservation_id", reservationId);
      const result = await registerCheckoutAction(formData);
      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={registerCheckout}
      className={
        compact
          ? "inline-flex rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
          : "mt-2 inline-flex w-full items-center justify-center rounded-md bg-mkt-slate px-3 py-2 text-xs font-semibold text-white transition hover:bg-mkt-slate-deep disabled:opacity-50"
      }
    >
      {pending ? "Registrando salida…" : "Registrar salida y liberar cama"}
    </button>
  );
}
