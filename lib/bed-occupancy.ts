import { getMexicoCityDateString } from "@/lib/dates";

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
  locker_number?: number | null;
  locker_days?: number;
  /** true when check-in/out includes today (in-house) */
  in_house_today?: boolean;
};

type ReservationGuestRow = {
  bed_id: string | null;
  reservation_id: string;
  guest_id: string;
  locker_number?: number | null;
  locker_days?: number | null;
  guests?: { full_name?: string; phone?: string; email?: string } | { full_name?: string; phone?: string; email?: string }[] | null;
  reservations?: ReservationRow | ReservationRow[] | null;
};

type ReservationRow = {
  id: string;
  status?: string;
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

/** Guest occupies the bed on calendar day `today` (check-out day inclusive). */
export function reservationInHouseOnDate(
  checkIn: string,
  checkOut: string,
  today = getMexicoCityDateString(),
) {
  return checkIn <= today && checkOut >= today;
}

function assignmentRank(reservation: ReservationRow, today: string) {
  if (reservation.status === "cancelled") return -1;

  const checkIn = reservation.check_in_date ?? "";
  const checkOut = reservation.check_out_date ?? "";
  if (!checkIn || !checkOut) return -1;

  const statusBoost = STATUS_PRIORITY[reservation.status ?? ""] ?? 5;
  const inHouse = reservationInHouseOnDate(checkIn, checkOut, today);
  const upcoming = checkIn > today;

  // Same rows as Reservas: active stays visible on the map even if dates passed but status still active
  if (inHouse) return 1000 + statusBoost;
  if (upcoming) return 500 + statusBoost;
  if (reservation.status === "active") return 100 + statusBoost;

  return -1;
}

function rowToDetail(row: ReservationGuestRow, today: string): BedOccupancyDetail | null {
  if (!row.bed_id) return null;

  const reservation = unwrap(row.reservations);
  if (!reservation) return null;

  const guest = unwrap(row.guests);
  const folio = unwrap(reservation.folios);
  const checkIn = reservation.check_in_date ?? "";
  const checkOut = reservation.check_out_date ?? "";

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
    locker_number: row.locker_number != null ? Number(row.locker_number) : null,
    locker_days: Number(row.locker_days ?? 0),
    in_house_today: checkIn && checkOut ? reservationInHouseOnDate(checkIn, checkOut, today) : false,
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
 * Prefers in-house today, then upcoming, then status=active (matches operational list).
 */
export function buildBedOccupancyMap(
  rows: ReservationGuestRow[],
  today = getMexicoCityDateString(),
) {
  const map = new Map<string, BedOccupancyDetail>();
  const metaByBed = new Map<string, { rank: number; checkOut: string; createdAt: string }>();

  for (const row of rows) {
    if (!row.bed_id) continue;

    const reservation = unwrap(row.reservations);
    if (!reservation) continue;

    const rank = assignmentRank(reservation, today);
    if (rank < 0) continue;

    const checkOut = reservation.check_out_date ?? "";
    const createdAt = reservation.created_at ?? "";
    const prev = metaByBed.get(row.bed_id);

    if (prev && !isBetterCandidate({ rank, checkOut, createdAt }, prev)) {
      continue;
    }

    const detail = rowToDetail(row, today);
    if (!detail) continue;

    map.set(row.bed_id, detail);
    metaByBed.set(row.bed_id, { rank, checkOut, createdAt });
  }

  return map;
}
