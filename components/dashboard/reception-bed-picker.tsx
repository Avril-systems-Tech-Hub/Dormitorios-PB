"use client";

import { useEffect, useState, useTransition } from "react";
import { getBedsMapForChange } from "@/actions/operations";

export type ReceptionBedOption = {
  id: string;
  bed_number: number;
  status: string;
  occupied_by: string | null;
};

type ReceptionBedPickerProps = {
  selectedBedId: string | null;
  onSelect: (bedId: string, bedNumber: number) => void;
  disabled?: boolean;
  /** Bed already assigned to this guest remains selectable when changing. */
  allowBedId?: string | null;
};

export function ReceptionBedPicker({ selectedBedId, onSelect, disabled, allowBedId }: ReceptionBedPickerProps) {
  const [beds, setBeds] = useState<ReceptionBedOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getBedsMapForChange();
        setBeds(data);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return <p className="text-sm text-text-muted">Cargando camas…</p>;
  }

  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
      {beds.map((bed) => {
        const isBlocked = bed.status === "blocked";
        const isOccupied = Boolean(bed.occupied_by);
        const isOwnBed = allowBedId != null && bed.id === allowBedId;
        const isUnavailable = isBlocked || (isOccupied && !isOwnBed);
        const isSelected = selectedBedId === bed.id;

        return (
          <button
            key={bed.id}
            type="button"
            disabled={disabled || isUnavailable}
            onClick={() => onSelect(bed.id, bed.bed_number)}
            title={
              isBlocked
                ? "Cama bloqueada"
                : isOccupied
                  ? `Ocupada: ${bed.occupied_by}`
                  : `Cama ${bed.bed_number}`
            }
            className={`flex h-11 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition sm:h-12 ${
              isSelected
                ? "border-brand-primary bg-brand-primary text-white"
                : isUnavailable
                  ? "cursor-not-allowed border-border-soft bg-surface-soft/60 text-text-muted opacity-60"
                  : "border-border-soft bg-white text-text-main hover:border-brand-primary/50 hover:bg-brand-primary/5"
            }`}
          >
            {bed.bed_number}
          </button>
        );
      })}
    </div>
  );
}
