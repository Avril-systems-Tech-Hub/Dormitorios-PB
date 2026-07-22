import type { GuestAssignmentGuestRow } from "@/components/ui/guest-assignment-actions";

type GuestFields = {
  full_name?: string;
  phone?: string | null;
  email?: string | null;
};

type ReservationGuestEmbed = GuestAssignmentGuestRow & {
  guests?: GuestFields | GuestFields[] | null;
};

type ReservationEmbed = {
  id?: string;
  nights?: number;
  reservation_guests?: ReservationGuestEmbed[] | null;
};

export type FolioWithGuests = {
  folio_code?: string;
  reservations?: ReservationEmbed | ReservationEmbed[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function guestName(row: ReservationGuestEmbed): string | undefined {
  return unwrap(row.guests)?.full_name?.trim() || undefined;
}

/** Flatten guests + primary label from a folio → reservations embed. */
export function summarizeFolioGuests(folio: FolioWithGuests | null | undefined) {
  const reservations = Array.isArray(folio?.reservations)
    ? folio.reservations
    : folio?.reservations
      ? [folio.reservations]
      : [];

  const guests = reservations.flatMap((reservation) =>
    Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests : [],
  );

  const names = guests.map(guestName).filter((name): name is string => Boolean(name));
  const primaryName = names[0] ?? "Sin huésped";
  const primaryReservation = reservations[0];

  return {
    folioCode: folio?.folio_code ?? "Sin folio",
    primaryName,
    guestNames: names,
    guests,
    reservationId: primaryReservation?.id ?? "",
    nights: Number(primaryReservation?.nights ?? 1) || 1,
    searchText: [primaryName, ...names, folio?.folio_code ?? ""].filter(Boolean).join(" "),
  };
}
