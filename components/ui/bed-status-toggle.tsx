"use client";

import { useTransition } from "react";
import { updateBedStatusAction } from "@/actions/operations";
import type { BedStatus } from "@/types/domain";
import { cn } from "@/lib/utils";

type BedStatusToggleProps = {
  bedId: string;
  bedNumber: number;
  status: BedStatus;
  returnTo?: string;
};

export function BedStatusToggle({
  bedId,
  bedNumber,
  status,
  returnTo = "/dashboard/beds",
}: BedStatusToggleProps) {
  const [pending, startTransition] = useTransition();
  const isBlocked = status === "blocked";

  const handleClick = () => {
    const nextStatus: BedStatus = isBlocked ? "available" : "blocked";
    startTransition(() => {
      const fd = new FormData();
      fd.set("bed_id", bedId);
      fd.set("status", nextStatus);
      fd.set("return_to", returnTo);
      updateBedStatusAction(fd);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "mt-2 w-full rounded-md border px-2 py-1 text-xs font-medium transition",
        isBlocked
          ? "border-success/40 bg-success/10 text-success hover:bg-success/15"
          : "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10",
        pending && "cursor-wait opacity-60",
      )}
      title={
        isBlocked
          ? `Quitar bloqueo de cama ${bedNumber}`
          : `Bloquear cama ${bedNumber} (mantenimiento)`
      }
    >
      {pending ? "Guardando…" : isBlocked ? "Desbloquear cama" : "Bloquear cama"}
    </button>
  );
}
