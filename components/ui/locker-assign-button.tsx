"use client";

import { useState, useTransition } from "react";
import { assignLockerAction } from "@/actions/operations";
import { LOCKER_DAILY_PRICE } from "@/hooks/use-reservation-form";
import { cn } from "@/lib/utils";

type LockerAssignButtonProps = {
  reservationId: string;
  guestId: string;
  lockerNumber: number | null;
  lockerDays: number;
  nights: number;
  returnTo?: string;
};

export function LockerAssignButton({
  reservationId,
  guestId,
  lockerNumber,
  lockerDays,
  nights,
  returnTo = "/dashboard/reservations",
}: LockerAssignButtonProps) {
  const [open, setOpen] = useState(false);
  const [addLocker, setAddLocker] = useState(lockerDays > 0 ? "yes" : "no");
  const [lockerDaysInput, setLockerDaysInput] = useState(String(lockerDays > 0 ? lockerDays : nights));
  const [lockerNumberInput, setLockerNumberInput] = useState(
    lockerNumber != null ? String(lockerNumber) : "",
  );
  const [pending, startTransition] = useTransition();

  const hasLockerService = lockerDays > 0;
  const label =
    lockerNumber != null
      ? `Locker ${lockerNumber}`
      : hasLockerService
        ? "Locker pendiente"
        : "Sin locker";

  const handleSubmit = () => {
    startTransition(() => {
      const fd = new FormData();
      fd.set("reservation_id", reservationId);
      fd.set("guest_id", guestId);
      fd.set("return_to", returnTo);
      fd.set("add_locker", addLocker);
      fd.set("locker_days", lockerDaysInput);
      fd.set("locker_number", lockerNumberInput);
      assignLockerAction(fd);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAddLocker(lockerDays > 0 ? "yes" : "no");
          setLockerDaysInput(String(lockerDays > 0 ? lockerDays : nights));
          setLockerNumberInput(lockerNumber != null ? String(lockerNumber) : "");
          setOpen(true);
        }}
        className={cn(
          "text-text-muted underline decoration-dotted underline-offset-2 transition hover:text-text-main",
          hasLockerService && lockerNumber == null && "font-medium text-amber-700",
        )}
        title="Asignar o editar locker"
      >
        · {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-main">Locker del huésped</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xl leading-none text-text-muted hover:text-text-main"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Registra el servicio de locker y el número físico asignado en recepción.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">¿Incluye locker?</label>
                <select
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                  value={addLocker}
                  onChange={(e) => setAddLocker(e.target.value)}
                >
                  <option value="no">No</option>
                  <option value="yes">Sí (+${LOCKER_DAILY_PRICE}/día)</option>
                </select>
              </div>

              {addLocker === "yes" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Días de locker</label>
                    <input
                      type="number"
                      min={1}
                      max={nights}
                      className="w-full max-w-[140px] rounded-lg border border-border-soft px-3 py-2 text-sm"
                      value={lockerDaysInput}
                      onChange={(e) => setLockerDaysInput(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-text-muted">Máx. {nights} noche{nights === 1 ? "" : "s"}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Número de locker</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full max-w-[140px] rounded-lg border border-border-soft px-3 py-2 text-sm"
                      placeholder="Ej. 12"
                      value={lockerNumberInput}
                      onChange={(e) => setLockerNumberInput(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Vacío = aparece como locker pendiente hasta que lo asignes.
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-text-main"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="flex-1 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
