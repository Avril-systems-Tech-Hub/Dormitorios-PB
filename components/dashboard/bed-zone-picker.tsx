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

function groupBedsByBunk(beds: BedMapItem[]) {
  const groups = new Map<string, BedMapItem[]>();
  for (const bed of beds) {
    const match = String(bed.bed_number).match(/^(.*?)([a-c])$/i);
    const bunkNumber = match?.[1] || String(bed.bed_number);
    const current = groups.get(bunkNumber) ?? [];
    current.push(bed);
    groups.set(bunkNumber, current);
  }
  return Array.from(groups.entries()).map(([bunkNumber, bunkBeds]) => ({
    bunkNumber,
    beds: bunkBeds.sort((a, b) =>
      String(a.bed_number).localeCompare(String(b.bed_number), "es-MX", {
        numeric: true,
      }),
    ),
  }));
}

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
            ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-8"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7"
        }
      >
        {groupBedsByBunk(beds).map((bunk) => (
          <div
            key={bunk.bunkNumber}
            className="rounded-xl border border-border-soft bg-surface-soft/35 p-2 shadow-sm"
          >
            <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Litera {bunk.bunkNumber}
            </p>
            <div className="space-y-1.5">
              {bunk.beds.map((bed) => {
                const isBlocked = bed.status === "blocked";
                const isOccupied = Boolean(bed.occupied_by);
                const isOwnBed = allowBedId != null && bed.id === allowBedId;
                const isUnavailable = isBlocked || (isOccupied && !isOwnBed);
                const isSelected = selectedBedId === bed.id;
                const label = formatBedLabel(bed.bed_number, bed.zone) ?? bed.bed_number;
                const stateLabel = isBlocked
                  ? "Bloqueada"
                  : isOccupied
                    ? "Ocupada"
                    : "Libre";

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
                          : `${label} — libre`
                    }
                    className={`flex w-full items-center justify-between gap-1 rounded-md border px-2 text-xs font-semibold transition ${
                      compact ? "h-9" : "h-10"
                    } ${
                      isSelected
                        ? "border-brand-primary bg-brand-primary text-white ring-2 ring-brand-primary/25"
                        : isBlocked
                          ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-600"
                          : isOccupied && !isOwnBed
                            ? "cursor-not-allowed border-red-300 bg-red-100 text-red-800"
                            : isOccupied && isOwnBed
                              ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
                              : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-100"
                    }`}
                  >
                    <span>{bed.bed_number}</span>
                    <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">
                      {isSelected ? "Elegida" : stateLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border-soft bg-white px-3 py-2 text-[11px] font-medium text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-emerald-400 bg-emerald-100" />
          Libre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-red-400 bg-red-100" />
          Ocupada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-slate-200" />
          Bloqueada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
          Seleccionada
        </span>
      </div>
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
