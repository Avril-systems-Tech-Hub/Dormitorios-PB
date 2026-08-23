"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateServicePricesAction } from "@/actions/service-prices";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SERVICE_PRICE_HINTS,
  SERVICE_PRICE_KEYS,
  type ServicePriceRow,
} from "@/lib/service-prices";
import { isNextRedirect } from "@/lib/utils";

export function ServicePricesPanel({ initialPrices }: { initialPrices: ServicePriceRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialPrices.map((row) => [row.key, row.amount.toFixed(2)])),
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-text-main">Control de precios</h2>
      <p className="mt-1 text-sm text-text-muted">
        Estas tarifas las usa recepción al cobrar. Recepción no puede cambiarlas; solo administración.
        Los cobros ya registrados no se modifican.
      </p>
      <Card className="mt-4">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              try {
                const result = await updateServicePricesAction(formData);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(result.message);
              } catch (error) {
                if (isNextRedirect(error)) throw error;
                toast.error(
                  error instanceof Error ? error.message : "No se pudieron guardar los precios.",
                );
              }
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {SERVICE_PRICE_KEYS.map((key) => {
              const row = initialPrices.find((item) => item.key === key);
              return (
                <label key={key} className="block space-y-1.5">
                  <span className="text-sm font-medium text-text-main">{row?.label ?? key}</span>
                  <span className="block text-xs text-text-muted">{SERVICE_PRICE_HINTS[key]}</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                      $
                    </span>
                    <Input
                      name={key}
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max="9999.99"
                      step="0.01"
                      required
                      className="pl-7 tabular-nums"
                      value={values[key] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar precios"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
