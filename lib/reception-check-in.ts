export type ReceptionSearchGuest = {
  guestId: string;
  fullName: string;
  phone: string | null;
  bedId: string | null;
  bedNumber: number | null;
  lockerDays: number;
  lockerNumber: number | null;
};

export type ReceptionSearchResult = {
  reservationId: string;
  folioId: string;
  folioCode: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  status: string;
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

export const RECEPTION_WIZARD_STEPS = ["search", "review", "confirm"] as const;
export type ReceptionWizardStep = (typeof RECEPTION_WIZARD_STEPS)[number];

export const RECEPTION_STEP_LABELS: Record<ReceptionWizardStep, string> = {
  search: "Buscar",
  review: "Cobrar",
  confirm: "Confirmar y asignar",
};

export const RECENT_RESERVATION_LIMIT_OPTIONS = [5, 10, 15, 20] as const;
export type RecentReservationLimit = (typeof RECENT_RESERVATION_LIMIT_OPTIONS)[number];
export const DEFAULT_RECENT_RESERVATION_LIMIT: RecentReservationLimit = 20;

export function normalizeRecentReservationLimit(value: number): RecentReservationLimit {
  if (RECENT_RESERVATION_LIMIT_OPTIONS.includes(value as RecentReservationLimit)) {
    return value as RecentReservationLimit;
  }
  return DEFAULT_RECENT_RESERVATION_LIMIT;
}

type RawGuestRow = {
  guest_id?: string;
  bed_id?: string | null;
  locker_number?: number | null;
  locker_days?: number | null;
  guests?:
    | { full_name?: string; phone?: string; email?: string }
    | { full_name?: string; phone?: string; email?: string }[]
    | null;
  beds?: { bed_number?: number } | { bed_number?: number }[] | null;
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
    const lockerNumber =
      g.locker_number != null && Number(g.locker_number) > 0 ? Number(g.locker_number) : null;
    return {
      guestId: g.guest_id ?? "",
      fullName: guest?.full_name ?? "Huésped",
      phone: guest?.phone ?? null,
      bedId: g.bed_id ?? null,
      bedNumber: bed?.bed_number ?? null,
      lockerDays,
      lockerNumber,
    };
  });

  const allBedsAssigned = guestRows.length > 0 && guestRows.every((g) => g.bed_id);
  const allLockersAssigned = guests.every(
    (g) => g.lockerDays <= 0 || (g.lockerNumber != null && g.lockerNumber > 0),
  );

  return {
    reservationId: row.id,
    folioId: folio.id,
    folioCode: folio.folio_code ?? "Sin folio",
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    status: row.status,
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
