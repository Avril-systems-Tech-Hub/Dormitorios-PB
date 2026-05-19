import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import {
  GuestHistoryDetail,
  GuestStatsCell,
  type GuestStaySummary,
} from "@/components/dashboard/guest-history-detail";
import { createClient } from "@/lib/supabase/server";

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

type GuestRecord = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  created_at: string;
  reservation_guests?: ReservationGuestRow[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function getStays(guest: GuestRecord): GuestStaySummary[] {
  const rows = Array.isArray(guest.reservation_guests) ? guest.reservation_guests : [];
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

export default async function GuestsPage() {
  const supabase = await createClient();

  const { data: guestsRaw } = await supabase
    .from("guests")
    .select(
      "id,full_name,phone,email,created_at,reservation_guests(beds(bed_number),locker_number,reservations(check_in_date,check_out_date,nights,status,reservation_source,folios(folio_code,payment_status)))",
    )
    .order("full_name", { ascending: true })
    .limit(500);

  const guestsWithStays = ((guestsRaw ?? []) as GuestRecord[])
    .map((guest) => ({ guest, stays: getStays(guest) }))
    .filter(({ stays }) => stays.length > 0)
    .sort((a, b) => {
      const aLatest = a.stays.reduce((max, s) => (s.checkIn > max ? s.checkIn : max), "");
      const bLatest = b.stays.reduce((max, s) => (s.checkIn > max ? s.checkIn : max), "");
      return bLatest.localeCompare(aLatest);
    });

  const rows = guestsWithStays.map(({ guest, stays }) => {
    const latest = stays.reduce((best, stay) => (stay.checkIn > best.checkIn ? stay : best), stays[0]);
    const totalNights = stays.reduce((sum, stay) => sum + stay.nights, 0);

    const filterText = [
      guest.full_name,
      guest.phone,
      guest.email,
      latest.folioCode,
      String(stays.length),
      String(totalNights),
    ]
      .filter(Boolean)
      .join(" ");

    return [
      ft(
        filterText,
        <div key={`guest-${guest.id}`} className="min-w-[10rem]">
          <p className="font-medium text-text-main">{guest.full_name}</p>
          {guest.email ? <p className="mt-0.5 truncate text-xs text-text-muted">{guest.email}</p> : null}
        </div>,
      ),
      ft(guest.phone, <span className="whitespace-nowrap tabular-nums">{guest.phone}</span>),
      ft(
        `${stays.length} estadías ${totalNights} noches`,
        <GuestStatsCell
          key={`stats-${guest.id}`}
          stayCount={stays.length}
          totalNights={totalNights}
          paymentStatus={latest.paymentStatus}
          source={latest.source ?? "guest_app"}
        />,
      ),
      ft(
        `${latest.checkIn} ${latest.checkOut} ${latest.folioCode ?? ""}`,
        <GuestHistoryDetail key={`history-${guest.id}`} stays={stays} latest={latest} />,
      ),
      new Date(guest.created_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }),
    ];
  });

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Huéspedes</h2>
        <p className="mt-1 text-sm text-text-muted">
          Personas con al menos una estadía. Usa la búsqueda para filtrar; expande el historial solo cuando lo
          necesites.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          <span className="font-medium text-text-main">{rows.length}</span> huéspedes con estadía registrada.
        </p>
      </Card>

      <ResponsiveTable
        headers={["Huésped", "Teléfono", "Resumen", "Última visita", "Alta"]}
        rows={rows}
        filterMode="global"
        dense
      />
    </div>
  );
}
