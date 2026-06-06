import { mexicoCityCalendarDate } from "@/lib/dates";

const CDMX = "America/Mexico_City";

/** Day of month from check-in date (legacy "Día" column). */
export function formatRosterDay(checkInDate: string): string {
  const parts = checkInDate.split("-");
  const day = Number(parts[2]);
  return Number.isFinite(day) ? String(day) : "—";
}

export function formatRosterDate(dateString: string): string {
  return mexicoCityCalendarDate(dateString).toLocaleDateString("es-MX", {
    timeZone: CDMX,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatRosterTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("es-MX", {
    timeZone: CDMX,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function computeGuestLineTotal(
  nights: number,
  finalRate: number,
  lockerAmount: number,
): number {
  return Number((finalRate * Math.max(0, nights) + lockerAmount).toFixed(2));
}
