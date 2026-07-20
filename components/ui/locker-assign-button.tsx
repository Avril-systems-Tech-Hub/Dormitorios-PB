"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignLockerAction } from "@/actions/operations";
import { LOCKER_DAILY_PRICE } from "@/hooks/use-reservation-form";
import { cn } from "@/lib/utils";

type LockerAssignButtonProps = {
  reservationId: string;
  guestId: string;
  lockerNumber: string | null;
  lockerDays: number;
  nights: number;
  returnTo?: string;
  /** include = contratar locker; assign = asignar número (solo si ya requiere locker) */
  mode: "include" | "assign";
};

export function LockerAssignButton({
  reservationId,
  guestId,
  lockerNumber,
  lockerDays,
  nights,
  returnTo = "/dashboard/reservations",
  mode,
}: LockerAssignButtonProps) {
  const [open, setOpen] = useState(false);
  const [addLocker, setAddLocker] = useState(lockerDays > 0 ? "yes" : "no");
  const [lockerDaysInput, setLockerDaysInput] = useState(String(lockerDays > 0 ? lockerDays : nights));
  const [lockerNumberInput, setLockerNumberInput] = useState(lockerNumber ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const hasLockerService = lockerDays > 0;
  const hasLockerNumber = Boolean(lockerNumber);

  const openModal = () => {
    setAddLocker(mode === "include" ? "yes" : lockerDays > 0 ? "yes" : "no");
    setLockerDaysInput(String(lockerDays > 0 ? lockerDays : nights));
    setLockerNumberInput(lockerNumber ?? "");
    setOpen(true);
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reservation_id", reservationId);
      fd.set("guest_id", guestId);
      fd.set("return_to", returnTo);
      fd.set("add_locker", addLocker);
      fd.set("locker_days", lockerDaysInput);
      fd.set("locker_number", lockerNumberInput);
      const result = await assignLockerAction(fd);
      if (result.status === "success") {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  if (mode === "include") {
    return (
      <>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex h-7 items-center rounded-md border border-border-soft bg-white px-2 text-xs font-medium text-text-muted transition hover:bg-surface-soft hover:text-text-main"
        >
          Incluir locker
        </button>

        {open ? (
          <LockerAssignModal
            title="Incluir locker"
            description="El huésped requiere locker. Registra los días de servicio; el número físico puede asignarse después."
            addLocker={addLocker}
            setAddLocker={setAddLocker}
            lockerDaysInput={lockerDaysInput}
            setLockerDaysInput={setLockerDaysInput}
            lockerNumberInput={lockerNumberInput}
            setLockerNumberInput={setLockerNumberInput}
            nights={nights}
            pending={pending}
            onClose={() => setOpen(false)}
            onSubmit={handleSubmit}
            showNumberField={false}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {hasLockerNumber ? (
        <>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-amber-50 text-amber-800",
            )}
          >
            Locker {lockerNumber}
          </span>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-7 items-center rounded-md border border-border-soft bg-white px-2 text-xs font-medium text-text-main transition hover:bg-surface-soft"
          >
            Cambiar
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex h-7 items-center rounded-md border border-amber-300/60 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          Agregar locker
        </button>
      )}

      {open ? (
        <LockerAssignModal
          title={hasLockerNumber ? "Editar locker" : "Agregar locker"}
          description="Asigna el código físico de locker para este huésped (letras y/o números)."
          addLocker={addLocker}
          setAddLocker={setAddLocker}
          lockerDaysInput={lockerDaysInput}
          setLockerDaysInput={setLockerDaysInput}
          lockerNumberInput={lockerNumberInput}
          setLockerNumberInput={setLockerNumberInput}
          nights={nights}
          pending={pending}
          onClose={() => setOpen(false)}
          onSubmit={handleSubmit}
          showNumberField
          hasLockerService={hasLockerService}
        />
      ) : null}
    </>
  );
}

function LockerAssignModal({
  title,
  description,
  addLocker,
  setAddLocker,
  lockerDaysInput,
  setLockerDaysInput,
  lockerNumberInput,
  setLockerNumberInput,
  nights,
  pending,
  onClose,
  onSubmit,
  showNumberField,
  hasLockerService = true,
}: {
  title: string;
  description: string;
  addLocker: string;
  setAddLocker: (value: string) => void;
  lockerDaysInput: string;
  setLockerDaysInput: (value: string) => void;
  lockerNumberInput: string;
  setLockerNumberInput: (value: string) => void;
  nights: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
  showNumberField: boolean;
  hasLockerService?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-main">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-text-muted hover:text-text-main"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-text-muted">{description}</p>

        <div className="mt-4 space-y-3">
          {!hasLockerService ? (
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
          ) : null}

          {addLocker === "yes" || hasLockerService ? (
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
                <p className="mt-1 text-xs text-text-muted">
                  Máx. {nights} noche{nights === 1 ? "" : "s"}
                </p>
              </div>
              {showNumberField ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Código de locker</label>
                  <input
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    className="w-full max-w-[140px] rounded-lg border border-border-soft px-3 py-2 text-sm uppercase"
                    placeholder="Ej. 12 o A1"
                    value={lockerNumberInput}
                    onChange={(e) => setLockerNumberInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Letras y/o números. Vacío = pendiente de asignar.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border-soft px-4 py-2 text-sm font-medium text-text-main"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="flex-1 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
