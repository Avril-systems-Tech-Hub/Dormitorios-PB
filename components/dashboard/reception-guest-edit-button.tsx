"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateReceptionGuestAction } from "@/actions/operations";
import { ReceptionBedPicker } from "@/components/dashboard/reception-bed-picker";
import { MexicanPhoneInput } from "@/components/guest/mexican-phone-input";
import { Button } from "@/components/ui/button";
import { normalizeMexicanPhone } from "@/lib/phone";

type ReceptionGuestEditButtonProps = {
  reservationId: string;
  guestId: string;
  fullName: string;
  phone: string | null;
  bedId: string | null;
  lockerNumber: string | null;
  canEditAssignments: boolean;
};

export function ReceptionGuestEditButton({
  reservationId,
  guestId,
  fullName,
  phone,
  bedId,
  lockerNumber,
  canEditAssignments,
}: ReceptionGuestEditButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fullName);
  const [phoneValue, setPhoneValue] = useState(normalizeMexicanPhone(phone ?? ""));
  const [selectedBedId, setSelectedBedId] = useState(bedId);
  const [lockerValue, setLockerValue] = useState(lockerNumber ?? "");
  const [pending, startTransition] = useTransition();

  function openModal() {
    setName(fullName);
    setPhoneValue(normalizeMexicanPhone(phone ?? ""));
    setSelectedBedId(bedId);
    setLockerValue(lockerNumber ?? "");
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reservation_id", reservationId);
      fd.set("guest_id", guestId);
      fd.set("full_name", name);
      fd.set("phone", phoneValue);
      if (canEditAssignments) {
        fd.set("bed_id", selectedBedId ?? "");
        fd.set("locker_number", lockerValue);
      }
      const result = await updateReceptionGuestAction(fd);
      if (result.status === "success") {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex h-7 items-center rounded-md border border-border-soft bg-white px-2 text-xs font-medium text-text-main transition hover:bg-surface-soft"
      >
        Editar
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-text-main">Editar huésped</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xl leading-none text-text-muted hover:text-text-main"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Solo nombre, teléfono, cama y locker.
            </p>

            <div className="mt-4 space-y-4">
              <label className="flex flex-col gap-1 text-sm text-text-muted">
                Nombre
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 rounded-lg border border-border-soft px-3 text-text-main"
                  autoComplete="name"
                />
              </label>

              <div>
                <p className="mb-1 text-sm text-text-muted">Teléfono</p>
                <MexicanPhoneInput value={phoneValue} onChange={setPhoneValue} />
              </div>

              {canEditAssignments ? (
                <>
                  <div>
                    <p className="mb-2 text-sm text-text-muted">Cama</p>
                    <ReceptionBedPicker
                      selectedBedId={selectedBedId}
                      allowBedId={bedId}
                      onSelect={(id) => setSelectedBedId(id)}
                    />
                  </div>
                  <label className="flex flex-col gap-1 text-sm text-text-muted">
                    Código de locker
                    <input
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      value={lockerValue}
                      onChange={(e) => setLockerValue(e.target.value)}
                      placeholder="Ej. 12 o A1"
                      className="h-10 max-w-[140px] rounded-lg border border-border-soft px-3 uppercase text-text-main"
                    />
                  </label>
                </>
              ) : (
                <p className="rounded-lg bg-surface-soft px-3 py-2 text-sm text-text-muted">
                  La estancia ya cerró. Solo se puede corregir nombre y teléfono.
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" disabled={pending} onClick={handleSave}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
