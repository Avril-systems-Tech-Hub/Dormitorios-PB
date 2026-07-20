import type { BedZone } from "@/types/domain";

export type { BedZone };

export const BED_ZONE_LABELS: Record<BedZone, string> = {
  mixta: "Mixta",
  mujeres: "Mujeres",
};

export const BED_TOTAL_COUNT = 66;

/** Display label: "Mixta 2a" / "Mujeres 1c". Falls back to "Cama …" if zone is missing. */
export function formatBedLabel(
  bedNumber: string | number | null | undefined,
  zone?: BedZone | string | null,
): string | null {
  if (bedNumber == null || bedNumber === "") return null;
  const bunk = String(bedNumber);
  if (zone === "mixta" || zone === "mujeres") {
    return `${BED_ZONE_LABELS[zone]} ${bunk}`;
  }
  return `Cama ${bunk}`;
}

export function isBedAssigned(bedNumber: string | number | null | undefined): boolean {
  return bedNumber != null && String(bedNumber).trim() !== "";
}

export function groupBedsByZone<T extends { zone?: BedZone | string | null }>(
  beds: T[],
): { mixta: T[]; mujeres: T[] } {
  const mixta: T[] = [];
  const mujeres: T[] = [];
  for (const bed of beds) {
    if (bed.zone === "mujeres") mujeres.push(bed);
    else mixta.push(bed);
  }
  return { mixta, mujeres };
}
