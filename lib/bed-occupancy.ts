import {
  getMexicoCityDateString,
  hasStayPeriodEnded,
  isWithinStayPeriod,
} from "@/lib/dates";
import { normalizeLockerCode } from "@/lib/locker";

export type BedOccupancyDetail = {
  reservation_id: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  folio_code?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  source?: string;
  created_at?: string;
  payment_status?: string;
  total_amount?: number;
  balance_due?: number;
  notes?: string;
  locker_number?: string | null;
  locker_days?: number;
  /** true when the 11:00–11:00 stay period includes now */
  in_house_today?: boolean;
  /** true when period ended at 11:00 but reception has not confirmed checkout */
  pending_checkout?: boolean;
};

type ReservationGuestRow = {
  bed_id: string | null;
  reservation_id: string;
  guest_id: string;
  locker_number?: string | number | null;
  locker_days?: number | null;
  guests?: { full_name?: string; phone?: string; email?: string } | { full_name?: string; phone?: string; email?: string }[] | null;
  reservations?: ReservationRow | ReservationRow[] | null;
};

type ReservationRow = {
  id?: string;
  status?: string;
  checked_out_at?: string | null;
  reservation_source?: string;
  check_in_date?: string;
  check_out_date?: string;
  nights?: number;
  notes?: string | null;
  created_at?: string;
  folios?: { folio_code?: string; payment_status?: string; total_amount?: number; balance_due?: number } | { folio_code?: string; payment_status?: string; total_amount?: number; balance_due?: number }[] | null;
};

const STATUS_PRIORITY: Record<string, number> = {
  active: 30,
  confirmed: 20,
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

const NON_BLOCKING_STATUSES = new Set(["cancelled", "checked_out"]);
const PAID_FOLIO_STATUSES = new Set(["partial", "liquidated"]);

/** Guest occupies the bed on calendar day `date` using [check-in, check-out). */
export function reservationInHouseOnDate(
  checkIn: string,
  checkOut: string,
  date = getMexicoCityDateString(),
) {
  return checkIn <= date && date < checkOut;
}

/** True while the guest still holds the bed under the 11:00–11:00 period. */
export function reservationIsInHouseNow(
  reservation: Pick<ReservationRow, "status" | "checked_out_at" | "check_in_date" | "check_out_date">,
  now = new Date(),
) {
  if (reservation.checked_out_at || NON_BLOCKING_STATUSES.has(reservation.status ?? "")) return false;
  const checkIn = reservation.check_in_date ?? "";
  const checkOut = reservation.check_out_date ?? "";
  return Boolean(checkIn && checkOut && isWithinStayPeriod(checkIn, checkOut, now));
}

/**
 * Whether the reservation blocks a calendar planning date.
 * For "today", uses the live 11:00–11:00 window; for other dates, [check-in, check-out).
 */
export function reservationBlocksDate(
  reservation: Pick<ReservationRow, "status" | "checked_out_at" | "check_in_date" | "check_out_date">,
  date = getMexicoCityDateString(),
  now = new Date(),
) {
  if (reservation.checked_out_at || NON_BLOCKING_STATUSES.has(reservation.status ?? "")) return false;
  const checkIn = reservation.check_in_date ?? "";
  const checkOut = reservation.check_out_date ?? "";
  if (!checkIn || !checkOut) return false;

  const today = getMexicoCityDateString(now);
  if (date === today) {
    return isWithinStayPeriod(checkIn, checkOut, now);
  }
  return reservationInHouseOnDate(checkIn, checkOut, date);
}

export function reservationHasPendingCheckout(
  reservation: Pick<ReservationRow, "status" | "checked_out_at" | "check_out_date">,
  now = new Date(),
) {
  if (reservation.checked_out_at || NON_BLOCKING_STATUSES.has(reservation.status ?? "")) return false;
  return Boolean(reservation.check_out_date && hasStayPeriodEnded(reservation.check_out_date, now));
}

function assignmentRank(reservation: ReservationRow, now: Date) {
  if (reservation.checked_out_at || NON_BLOCKING_STATUSES.has(reservation.status ?? "")) return -1;

  const folio = unwrap(reservation.folios);
  if (!PAID_FOLIO_STATUSES.has(folio?.payment_status ?? "")) return -1;

  const checkIn = reservation.check_in_date ?? "";
  const checkOut = reservation.check_out_date ?? "";
  if (!checkIn || !checkOut) return -1;

  const statusBoost = STATUS_PRIORITY[reservation.status ?? ""] ?? 5;
  if (reservationIsInHouseNow(reservation, now)) return 1000 + statusBoost;
  // Keep pending checkouts visible on the bed card so reception can confirm salida.
  if (reservationHasPendingCheckout(reservation, now)) return 100 + statusBoost;

  return -1;
}

function rowToDetail(row: ReservationGuestRow, now: Date): BedOccupancyDetail | null {
  if (!row.bed_id) return null;

  const reservation = unwrap(row.reservations);
  if (!reservation) return null;

  const guest = unwrap(row.guests);
  const folio = unwrap(reservation.folios);
  const checkIn = reservation.check_in_date ?? "";
  const checkOut = reservation.check_out_date ?? "";
  const inHouse = reservationIsInHouseNow(reservation, now);
  const pendingCheckout = reservationHasPendingCheckout(reservation, now);

  return {
    reservation_id: row.reservation_id,
    guest_name: guest?.full_name ?? undefined,
    guest_phone: guest?.phone ?? undefined,
    guest_email: guest?.email ?? undefined,
    folio_code: folio?.folio_code ?? undefined,
    check_in: checkIn || undefined,
    check_out: checkOut || undefined,
    nights: reservation.nights ?? undefined,
    source: reservation.reservation_source ?? undefined,
    created_at: reservation.created_at ?? undefined,
    payment_status: folio?.payment_status ?? undefined,
    total_amount: folio?.total_amount != null ? Number(folio.total_amount) : undefined,
    balance_due: folio?.balance_due != null ? Number(folio.balance_due) : undefined,
    notes: reservation.notes ?? undefined,
    locker_number: normalizeLockerCode(row.locker_number),
    locker_days: Number(row.locker_days ?? 0),
    in_house_today: inHouse,
    pending_checkout: pendingCheckout,
  };
}

function isBetterCandidate(
  next: { rank: number; checkOut: string; createdAt: string },
  current: { rank: number; checkOut: string; createdAt: string },
) {
  if (next.rank > current.rank) return true;
  if (next.rank < current.rank) return false;
  if (next.checkOut > current.checkOut) return true;
  if (next.checkOut < current.checkOut) return false;
  return next.createdAt > current.createdAt;
}

/**
 * One assignment per bed from reservation_guests (same source as Reservas).
 * Includes guests in the live 11:00–11:00 window, plus pending checkouts
 * (bed already free, salida still needs reception confirmation).
 * Unpaid, future, checked-out, cancelled and historical rows are excluded.
 */
export function buildBedOccupancyMap(
  rows: ReservationGuestRow[],
  todayOrNow: string | Date = new Date(),
) {
  const now = todayOrNow instanceof Date ? todayOrNow : new Date();
  const map = new Map<string, BedOccupancyDetail>();
  const metaByBed = new Map<string, { rank: number; checkOut: string; createdAt: string }>();

  for (const row of rows) {
    if (!row.bed_id) continue;

    const reservation = unwrap(row.reservations);
    if (!reservation) continue;

    const rank = assignmentRank(reservation, now);
    if (rank < 0) continue;

    const checkOut = reservation.check_out_date ?? "";
    const createdAt = reservation.created_at ?? "";
    const prev = metaByBed.get(row.bed_id);

    if (prev && !isBetterCandidate({ rank, checkOut, createdAt }, prev)) {
      continue;
    }

    const detail = rowToDetail(row, now);
    if (!detail) continue;

    map.set(row.bed_id, detail);
    metaByBed.set(row.bed_id, { rank, checkOut, createdAt });
  }

  return map;
}

/** Client-side search on beds map (folio, guest name, phone). */
export function matchesBedOccupancySearch(
  detail: BedOccupancyDetail | null | undefined,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (!detail) return false;

  const fields = [detail.folio_code, detail.guest_name, detail.guest_phone].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  return fields.some((value) => value.toLowerCase().includes(needle));
}
