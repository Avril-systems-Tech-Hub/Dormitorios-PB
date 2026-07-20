"use client";

import { BED_ZONE_LABELS, groupBedsByZone, formatBedLabel } from "@/lib/beds";
import type { BedZone } from "@/types/domain";

export type BedMapItem = {
  id: string;
  bed_number: string;
  zone: BedZone | string;
  status: string;
  occupied_by: string | null;
};

type BedZonePickerProps = {
  beds: BedMapItem[];
  selectedBedId: string | null;
  onSelect: (bedId: string) => void;
  disabled?: boolean;
  /** Bed already assigned to this guest remains selectable when changing. */
  allowBedId?: string | null;
  /** Compact = reception check-in; default = change modal. */
  compact?: boolean;
};

function ZoneSection({
  title,
  beds,
  selectedBedId,
  onSelect,
  disabled,
  allowBedId,
  compact,
}: {
  title: string;
  beds: BedMapItem[];
  selectedBedId: string | null;
  onSelect: (bedId: string) => void;
  disabled?: boolean;
  allowBedId?: string | null;
  compact?: boolean;
}) {
  if (beds.length === 0) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h4>
      <div
        className={
          compact
            ? "grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12"
            : "grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8"
        }
      >
        {beds.map((bed) => {
          const isBlocked = bed.status === "blocked";
          const isOccupied = Boolean(bed.occupied_by);
          const isOwnBed = allowBedId != null && bed.id === allowBedId;
          const isUnavailable = isBlocked || (isOccupied && !isOwnBed);
          const isSelected = selectedBedId === bed.id;
          const label = formatBedLabel(bed.bed_number, bed.zone) ?? bed.bed_number;

          return (
            <button
              key={bed.id}
              type="button"
              disabled={disabled || isUnavailable}
              onClick={() => onSelect(bed.id)}
              title={
                isBlocked
                  ? `${label} — bloqueada`
                  : isOccupied
                    ? `${label} — ocupada: ${bed.occupied_by}`
                    : label
              }
              className={`flex flex-col items-center justify-center rounded-lg border text-xs font-semibold transition ${
                compact ? "h-11 sm:h-12" : "px-2 py-2"
              } ${
                isSelected
                  ? "border-brand-primary bg-brand-primary text-white"
                  : isUnavailable
                    ? "cursor-not-allowed border-border-soft bg-surface-soft/60 text-text-muted opacity-60"
                    : "border-border-soft bg-white text-text-main hover:border-brand-primary/50 hover:bg-brand-primary/5"
              }`}
            >
              <span>{bed.bed_number}</span>
              {!compact && (
                <span className="mt-0.5 text-[10px] font-normal opacity-80">
                  {isBlocked ? "Bloqueada" : isOccupied ? "Ocupada" : "Libre"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Shared bed picker with Mixta / Mujeres sections for admin + reception. */
export function BedZonePicker({
  beds,
  selectedBedId,
  onSelect,
  disabled,
  allowBedId,
  compact = false,
}: BedZonePickerProps) {
  const { mixta, mujeres } = groupBedsByZone(beds);

  return (
    <div className="space-y-4">
      <ZoneSection
        title={BED_ZONE_LABELS.mixta}
        beds={mixta}
        selectedBedId={selectedBedId}
        onSelect={onSelect}
        disabled={disabled}
        allowBedId={allowBedId}
        compact={compact}
      />
      <ZoneSection
        title={`Solo ${BED_ZONE_LABELS.mujeres.toLowerCase()}`}
        beds={mujeres}
        selectedBedId={selectedBedId}
        onSelect={onSelect}
        disabled={disabled}
        allowBedId={allowBedId}
        compact={compact}
      />
    </div>
  );
}
