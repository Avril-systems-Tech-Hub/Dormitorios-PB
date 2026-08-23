"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerVisitorSaleAction } from "@/actions/visitor-sales";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-insights";
import {
  VISITOR_CONCEPT_LABELS,
  VISITOR_RESOURCE_LABELS,
  type VisitorConcept,
} from "@/lib/visitor-sales";
import type { PaymentMethod } from "@/types/domain";

type VisitorSaleFormProps = {
  concept: VisitorConcept;
  price: number;
};

export function VisitorSaleForm({ concept, price }: VisitorSaleFormProps) {
  const router = useRouter();
  const [visitorName, setVisitorName] = useState("");
  const [resourceNumber, setResourceNumber] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isPending, startTransition] = useTransition();

  const label = VISITOR_CONCEPT_LABELS[concept];
  const resourceLabel = VISITOR_RESOURCE_LABELS[concept];

  function submit() {
    if (!resourceNumber.trim()) {
      toast.error(`Indica el ${resourceLabel.toLowerCase()}.`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("El precio de este concepto no está configurado.");
      return;
    }
    setShowConfirmation(true);
  }

  function confirm() {
    const formData = new FormData();
    formData.set("submission_id", crypto.randomUUID());
    formData.set("concept", concept);
    formData.set("visitor_name", visitorName);
    formData.set("resource_number", resourceNumber);
    formData.set("method", method);
    formData.set("notes", notes);

    startTransition(async () => {
      const result = await registerVisitorSaleAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setShowConfirmation(false);
      toast.success(result.message);
      setVisitorName("");
      setResourceNumber("");
      setNotes("");
      setMethod("cash");
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold text-text-main">{label} de invitado</h2>
        <p className="mt-1 text-sm text-text-muted">
          Pago de una exhibición. Entra al turno abierto. El precio lo define administración.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm text-text-main">
            Nombre (opcional)
            <input
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
              placeholder="Si no hay nombre, se guarda como invitado"
              className="h-10 rounded-lg border border-border-soft bg-white px-3"
            />
          </label>
          <label className="grid gap-1 text-sm text-text-main">
            {resourceLabel}
            <input
              value={resourceNumber}
              onChange={(event) => setResourceNumber(event.target.value.toUpperCase())}
              placeholder={concept === "shower" ? "Ej. 3 o A1" : "Ej. 12 o B-4"}
              className="h-10 rounded-lg border border-border-soft bg-white px-3 uppercase"
              autoCapitalize="characters"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border-soft bg-surface-soft p-3 text-sm">
            <span className="text-text-muted">Precio vigente</span>
            <strong className="mt-1 block text-lg text-text-main">${price.toFixed(2)} MXN</strong>
            <span className="mt-1 block text-xs text-text-muted">
              Una exhibición · no se puede cambiar en recepción
            </span>
          </div>
          <label className="grid gap-1 text-sm text-text-main">
            Método
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              className="h-10 rounded-lg border border-border-soft bg-white px-3"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
            </select>
          </label>
        </div>

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notas (opcional)"
          className="mt-4 min-h-20 w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm"
        />

        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Necesitas un turno abierto. El cobro se liquida ahora y aparece en el corte.
        </div>

        <Button type="button" className="mt-5 w-full" disabled={isPending} onClick={submit}>
          {isPending ? "Registrando…" : `Cobrar ${label.toLowerCase()}`}
        </Button>
      </Card>

      {showConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setShowConfirmation(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="visitor-sale-confirmation-title"
            className="w-full max-w-md rounded-2xl border border-border-soft bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id="visitor-sale-confirmation-title" className="text-lg font-semibold text-text-main">
              Confirma el cobro
            </h2>
            <p className="mt-1 text-sm text-text-muted">Se registrará en tu turno abierto.</p>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Concepto</dt>
                <dd className="font-medium text-text-main">{label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Número</dt>
                <dd className="font-medium text-text-main">{resourceNumber.trim().toUpperCase() || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Nombre</dt>
                <dd className="font-medium text-text-main">{visitorName.trim() || "Invitado"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Total</dt>
                <dd className="font-medium text-text-main">${price.toFixed(2)} MXN</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Método</dt>
                <dd className="font-medium text-text-main">{PAYMENT_METHOD_LABELS[method]}</dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => setShowConfirmation(false)}
              >
                Cancelar
              </Button>
              <Button type="button" className="flex-1" disabled={isPending} onClick={confirm}>
                {isPending ? "Registrando…" : "Confirmar cobro"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
