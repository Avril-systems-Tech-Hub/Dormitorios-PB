"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getGuestSession } from "@/lib/guest-auth/session";
import { normalizeLoginEmail } from "@/lib/guest-auth/wallet";
import type { GuestStaySummary } from "@/components/dashboard/guest-history-detail";

export type GuestAccountData = {
  guest: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
  };
  /** Verified WaaP login email on the linked wallet (may differ from guests.email). */
  loginEmail: string | null;
  stays: GuestStaySummary[];
};

type ReservationInfo = {
  check_in_date?: string;
  check_out_date?: string;
  nights?: number;
  status?: string;
  reservation_source?: string;
  folios?: { folio_code?: string; payment_status?: string } | { folio_code?: string; payment_status?: string }[] | null;
};

type ReservationGuestRow = {
  beds?: { bed_number?: number } | { bed_number?: number }[] | null;
  locker_number?: number | null;
  reservations?: ReservationInfo | ReservationInfo[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function getStays(rows: ReservationGuestRow[]): GuestStaySummary[] {
  return rows.flatMap((row): GuestStaySummary[] => {
    const reservation = unwrap(row.reservations);
    if (!reservation?.check_in_date) return [];
    const bed = unwrap(row.beds);
    const folio = unwrap(reservation.folios);
    const stay: GuestStaySummary = {
      checkIn: reservation.check_in_date,
      checkOut: reservation.check_out_date ?? "—",
      nights: reservation.nights ?? 0,
      source: reservation.reservation_source ?? "guest_app",
    };
    if (bed?.bed_number != null) stay.bedNumber = bed.bed_number;
    if (row.locker_number !== undefined) stay.lockerNumber = row.locker_number;
    if (folio?.folio_code) stay.folioCode = folio.folio_code;
    if (folio?.payment_status) stay.paymentStatus = folio.payment_status;
    return [stay];
  });
}

export async function getGuestAccountDataAction(): Promise<GuestAccountData | null> {
  const session = await getGuestSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: guest } = await supabase
    .from("guests")
    .select("id,full_name,phone,email")
    .eq("id", session.guestId)
    .maybeSingle();

  if (!guest) return null;

  const normalizedEmail = normalizeLoginEmail(guest.email);
  let guestIds = [session.guestId];

  if (normalizedEmail) {
    const { data: emailMatches } = await supabase
      .from("guests")
      .select("id, email")
      .ilike("email", normalizedEmail);

    const ids =
      emailMatches
        ?.filter((row) => normalizeLoginEmail(row.email) === normalizedEmail)
        .map((row) => row.id) ?? [];

    if (ids.length) guestIds = ids;
  }

  const { data: wallet } = await supabase
    .from("guest_wallets")
    .select("email")
    .eq("guest_id", session.guestId)
    .eq("address", session.walletAddress)
    .eq("chain", "celo")
    .maybeSingle();

  const { data: reservationRows } = await supabase
    .from("reservation_guests")
    .select(
      "beds(bed_number),locker_number,reservations(check_in_date,check_out_date,nights,status,reservation_source,folios(folio_code,payment_status))",
    )
    .in("guest_id", guestIds);

  const rows = Array.isArray(reservationRows) ? reservationRows : [];
  const stays = getStays(rows as ReservationGuestRow[]).sort((a, b) =>
    b.checkIn.localeCompare(a.checkIn),
  );

  return {
    guest: {
      id: guest.id,
      full_name: guest.full_name,
      phone: guest.phone,
      email: guest.email,
    },
    loginEmail: wallet?.email ?? null,
    stays,
  };
}
