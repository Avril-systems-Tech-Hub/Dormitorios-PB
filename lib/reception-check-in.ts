import { normalizeLockerCode, isLockerCodeAssigned } from "@/lib/locker";

export type ReceptionSearchGuest = {
  reservationGuestId: string;
  guestId: string;
  fullName: string;
  phone: string | null;
  bedId: string | null;
  bedNumber: string | null;
  bedZone: string | null;
  lockerDays: number;
  lockerAmount: number;
  lockerNumber: string | null;
};

export type ReceptionSearchResult = {
  reservationId: string;
  folioId: string;
  folioCode: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  status: string;
  notes: string | null;
  createdAt: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: string;
  guests: ReceptionSearchGuest[];
  allBedsAssigned: boolean;
  allLockersAssigned: boolean;
};

export type ReceptionCheckInResult =
  | { ok: false; message: string }
  | {
      ok: true;
      message: string;
      newStatus: "liquidated" | "partial" | "pending";
      balanceDue: number;
      folioCode: string;
      folioId: string;
      whatsappSent: boolean;
      skippedPayment?: boolean;
    };

/** Search → assign bed/locker → collect payment (locker totals included at charge). */
export const RECEPTION_WIZARD_STEPS = ["search", "assign", "charge"] as const;
export type ReceptionWizardStep = (typeof RECEPTION_WIZARD_STEPS)[number];

export const RECEPTION_STEP_LABELS: Record<ReceptionWizardStep, string> = {
  search: "Buscar",
  assign: "Asignar cama y locker",
  charge: "Cobrar",
};

export function getReceptionLockerTotal(guests: ReceptionSearchGuest[]): number {
  return guests.reduce((sum, guest) => sum + Number(guest.lockerAmount ?? 0), 0);
}

export const RECENT_RESERVATION_LIMIT_OPTIONS = [5, 10, 15, 20] as const;
export type RecentReservationLimit = (typeof RECENT_RESERVATION_LIMIT_OPTIONS)[number];
export const DEFAULT_RECENT_RESERVATION_LIMIT: RecentReservationLimit = 20;

export const RECEPTION_LIST_PARAM = "reception";
export const RECEPTION_RESERVATION_PARAM = "checkin_reservation";
export type ReceptionListMode = "search" | "recent";

export function parseReceptionListMode(value: string | null | undefined): ReceptionListMode {
  return value === "recent" ? "recent" : "search";
}

export function buildReceptionDashboardPath(
  currentSearch: URLSearchParams | string,
  patch: {
    listMode?: ReceptionListMode | null;
    reservationId?: string | null;
  },
): string {
  const params = new URLSearchParams(
    typeof currentSearch === "string" ? currentSearch : currentSearch.toString(),
  );

  if (patch.listMode === "recent") {
    params.set(RECEPTION_LIST_PARAM, "recent");
  } else if (patch.listMode === "search" || patch.listMode === null) {
    params.delete(RECEPTION_LIST_PARAM);
  }

  if (patch.reservationId) {
    params.set(RECEPTION_RESERVATION_PARAM, patch.reservationId);
  } else if (patch.reservationId === null) {
    params.delete(RECEPTION_RESERVATION_PARAM);
  }

  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

/** Explicit parent for the reception back control; never uses browser history. */
export function getReceptionSessionBackHref(
  pathname: string,
  search: URLSearchParams | string,
): string | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;

  if (pathname !== "/dashboard") {
    return "/dashboard";
  }

  if (params.get(RECEPTION_RESERVATION_PARAM)) {
    return buildReceptionDashboardPath(params, { reservationId: null });
  }

  if (parseReceptionListMode(params.get(RECEPTION_LIST_PARAM)) === "recent") {
    return buildReceptionDashboardPath(params, { listMode: "search" });
  }

  return null;
}

export function normalizeRecentReservationLimit(value: number): RecentReservationLimit {
  if (RECENT_RESERVATION_LIMIT_OPTIONS.includes(value as RecentReservationLimit)) {
    return value as RecentReservationLimit;
  }
  return DEFAULT_RECENT_RESERVATION_LIMIT;
}

type RawGuestRow = {
  id?: string;
  guest_id?: string;
  bed_id?: string | null;
  locker_number?: string | number | null;
  locker_days?: number | null;
  locker_amount?: number | null;
  locker_price?: number | null;
  guests?:
    | { full_name?: string; phone?: string; email?: string }
    | { full_name?: string; phone?: string; email?: string }[]
    | null;
  beds?:
    | { bed_number?: string | number; zone?: string }
    | { bed_number?: string | number; zone?: string }[]
    | null;
};

type RawFolio = {
  id?: string;
  folio_code?: string;
  payment_status?: string;
  balance_due?: number;
  total_amount?: number;
  paid_amount?: number;
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function mapReservationToReceptionSearch(row: {
  id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  notes?: string | null;
  created_at?: string | null;
  folio_id?: string | null;
  folios?: RawFolio | RawFolio[] | null;
  reservation_guests?: RawGuestRow[] | null;
}): ReceptionSearchResult | null {
  const folio = unwrap(row.folios);
  if (!folio?.id) return null;

  const guestRows = Array.isArray(row.reservation_guests) ? row.reservation_guests : [];
  const guests: ReceptionSearchGuest[] = guestRows.map((g) => {
    const guest = unwrap(g.guests);
    const bed = unwrap(g.beds);
    const lockerDays = Number(g.locker_days ?? 0);
    const lockerPrice = Number(g.locker_price ?? 0);
    const storedLockerAmount = Number(g.locker_amount ?? 0);
    const lockerAmount =
      storedLockerAmount > 0
        ? storedLockerAmount
        : lockerDays > 0
          ? Number((lockerDays * (lockerPrice > 0 ? lockerPrice : 30)).toFixed(2))
          : 0;
    const lockerNumber = normalizeLockerCode(g.locker_number);
    return {
      reservationGuestId: g.id ?? "",
      guestId: g.guest_id ?? "",
      fullName: guest?.full_name ?? "Huésped",
      phone: guest?.phone ?? null,
      bedId: g.bed_id ?? null,
      bedNumber: bed?.bed_number != null ? String(bed.bed_number) : null,
      bedZone: bed?.zone ?? null,
      lockerDays,
      lockerAmount,
      lockerNumber,
    };
  });

  const allBedsAssigned = guestRows.length > 0 && guestRows.every((g) => g.bed_id);
  const allLockersAssigned = guests.every(
    (g) => g.lockerDays <= 0 || isLockerCodeAssigned(g.lockerNumber),
  );

  return {
    reservationId: row.id,
    folioId: folio.id,
    folioCode: folio.folio_code ?? "Sin folio",
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    status: row.status,
    notes: row.notes?.trim() || null,
    createdAt: row.created_at ?? null,
    totalAmount: Number(folio.total_amount ?? 0),
    paidAmount: Number(folio.paid_amount ?? 0),
    balanceDue: Number(folio.balance_due ?? 0),
    paymentStatus: folio.payment_status ?? "pending",
    guests,
    allBedsAssigned,
    allLockersAssigned,
  };
}
