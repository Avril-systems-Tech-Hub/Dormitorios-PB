"use client";

import { useEffect, useState, useTransition } from "react";
import { getBedsMapForChange } from "@/actions/operations";
import { BedZonePicker, type BedMapItem } from "@/components/dashboard/bed-zone-picker";

export type ReceptionBedOption = BedMapItem;

type ReceptionBedPickerProps = {
  selectedBedId: string | null;
  onSelect: (bedId: string, bedNumber: string) => void;
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
    <BedZonePicker
      beds={beds}
      selectedBedId={selectedBedId}
      allowBedId={allowBedId}
      disabled={disabled}
      compact
      onSelect={(bedId) => {
        const bed = beds.find((b) => b.id === bedId);
        if (bed) onSelect(bedId, bed.bed_number);
      }}
    />
  );
}
