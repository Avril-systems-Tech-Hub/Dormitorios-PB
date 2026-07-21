"use client";

import { useState } from "react";
import { closeShiftAction } from "@/actions/operations";
import { ReceptionExpenseModal } from "@/components/dashboard/reception-expense-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ReceptionShiftHeaderProps = {
  shiftLabel: string;
  shiftExpenseTotal: number;
  shiftExpenseCount?: number;
};

export function ReceptionShiftHeader({
  shiftLabel,
  shiftExpenseTotal,
  shiftExpenseCount = 0,
}: ReceptionShiftHeaderProps) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <>
      <Card className="border-brand-primary/25 bg-brand-primary/5 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-text-main sm:text-lg">Turno de recepción</h2>
              <Badge variant="warning">Turno activo</Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{shiftLabel}</p>
            <p className="mt-2 text-sm font-medium tabular-nums text-text-main">
              Egresos: ${shiftExpenseTotal.toFixed(2)}
              {shiftExpenseCount > 0 ? (
                <span className="font-normal text-text-muted">
                  {" "}
                  · {shiftExpenseCount} registro{shiftExpenseCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:min-w-[19rem]">
            {!confirmClose ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => setExpenseOpen(true)}
                >
                  Registrar egreso
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={() => setConfirmClose(true)}
                >
                  Terminar turno
                </Button>
              </>
            ) : (
              <form
                action={closeShiftAction}
                className="col-span-2 grid w-full grid-cols-2 gap-2"
              >
                <input type="hidden" name="return_to" value="/dashboard" />
                <Button type="submit" variant="primary" className="w-full">
                  Confirmar cierre
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => setConfirmClose(false)}
                >
                  Cancelar
                </Button>
              </form>
            )}
          </div>
        </div>
      </Card>

      <ReceptionExpenseModal
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        shiftLabel={shiftLabel}
        shiftExpenseTotal={shiftExpenseTotal}
      />
    </>
  );
}
