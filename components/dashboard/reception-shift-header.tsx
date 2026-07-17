"use client";

import { useState } from "react";
import Link from "next/link";
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
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-text-main sm:text-lg">Recepción</h1>
              <Badge variant="warning">Turno activo</Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{shiftLabel}</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-text-main">
              Egresos del turno: ${shiftExpenseTotal.toFixed(2)}
              {shiftExpenseCount > 0 ? (
                <span className="font-normal text-text-muted">
                  {" "}
                  · {shiftExpenseCount} registro{shiftExpenseCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </p>
            <Link
              href="/dashboard/expenses"
              className="mt-1.5 inline-flex text-sm font-medium text-brand-primary underline-offset-2 hover:underline"
            >
              Ver y editar egresos del turno
            </Link>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:min-w-[12rem] md:flex-col xl:min-w-[22rem] xl:flex-row">
            <Link
              href="/dashboard/beds"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border-soft bg-white px-4 py-2 text-sm font-medium text-text-main transition-colors hover:bg-surface-soft sm:flex-1 md:w-full xl:flex-initial"
            >
              Mapa de camas
            </Link>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1 md:w-full xl:flex-initial"
              onClick={() => setExpenseOpen(true)}
            >
              Registrar egreso
            </Button>
            {!confirmClose ? (
              <Button
                type="button"
                variant="primary"
                className="w-full sm:flex-1 md:w-full xl:flex-initial"
                onClick={() => setConfirmClose(true)}
              >
                Terminar turno
              </Button>
            ) : (
              <form action={closeShiftAction} className="flex w-full flex-col gap-2 sm:flex-row md:flex-col xl:flex-row">
                <input type="hidden" name="return_to" value="/dashboard" />
                <Button type="submit" variant="primary" className="w-full sm:flex-1">
                  Confirmar cierre
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:flex-1"
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
