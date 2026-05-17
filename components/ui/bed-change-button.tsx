"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { getBedsMapForChange, reassignBedAction } from "@/actions/operations";

type BedInfo = {
  id: string;
  bed_number: number;
  status: string;
  occupied_by: string | null;
};

export function BedChangeButton({
  reservationId,
  guestId,
  currentBed,
}: {
  reservationId: string;
  guestId: string;
  currentBed: string;
}) {
  const [open, setOpen] = useState(false);
  const [beds, setBeds] = useState<BedInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpen = () => {
    setOpen(true);
    setLoading(true);
    setSelected(null);
    getBedsMapForChange().then((data) => {
      setBeds(data);
      setLoading(false);
    });
  };

  const handleAssign = () => {
    if (!selected) return;
    startTransition(() => {
      const fd = new FormData();
      fd.set("reservation_id", reservationId);
      fd.set("guest_id", guestId);
      fd.set("new_bed_id", selected);
      fd.set("return_to", "/dashboard/reservations");
      reassignBedAction(fd);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="cursor-pointer text-text-main underline decoration-dotted underline-offset-2 hover:text-mkt-slate transition"
        title="Click para cambiar cama"
      >
        {currentBed}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-main">Cambiar cama</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-text-main text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Selecciona una cama libre para mover al huésped. Actual: <span className="font-medium text-text-main">{currentBed}</span>
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-text-muted text-center">Cargando mapa de camas...</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {beds.map((bed) => {
                    const isBlocked = bed.status === "blocked";
                    const isOccupied = !!bed.occupied_by;
                    const isSelected = selected === bed.id;
                    const isDisabled = isBlocked || isOccupied;

                    return (
                      <button
                        key={bed.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelected(bed.id)}
                        className={`rounded-lg border px-2 py-2 text-center text-xs transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
                            : isBlocked
                              ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed"
                              : isOccupied
                                ? "border-yellow-200 bg-yellow-50 text-yellow-700 cursor-not-allowed"
                                : "border-border-soft bg-gray-50 hover:border-green-400 hover:bg-green-50 cursor-pointer"
                        }`}
                      >
                        <p className="font-semibold">{bed.bed_number}</p>
                        {isBlocked ? (
                          <p className="text-[10px] mt-0.5">Bloqueada</p>
                        ) : isOccupied ? (
                          <p className="text-[10px] mt-0.5 truncate">{bed.occupied_by}</p>
                        ) : (
                          <p className="text-[10px] mt-0.5 text-green-600">Libre</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-text-muted">
                    {selected
                      ? `Seleccionada: Cama ${beds.find((b) => b.id === selected)?.bed_number}`
                      : "Haz click en una cama libre"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-md border border-border-soft bg-white px-3 py-1.5 text-xs font-medium text-text-main hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!selected || pending}
                      onClick={handleAssign}
                      className="rounded-md bg-mkt-slate px-3 py-1.5 text-xs font-medium text-white hover:bg-mkt-slate-deep transition disabled:opacity-40"
                    >
                      {pending ? "Asignando..." : "Confirmar cambio"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}