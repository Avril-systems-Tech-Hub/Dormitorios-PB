import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import {
  GuestHistoryDetail,
  GuestStatsCell,
  GuestFolioCell,
  GuestPaymentCell,
  type GuestStaySummary,
} from "@/components/dashboard/guest-history-detail";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile, requireModulePermission } from "@/lib/auth/guards";
import { ReceptionGuestRosterPage } from "@/components/dashboard/reception-guest-roster-page";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";

type ReservationInfo = {
  check_in_date?: string;
  check_out_date?: string;
  nights?: number;
  status?: string;
  reservation_source?: string;
  folios?:
    | {
        folio_code?: string;
        payment_status?: string;
        total_amount?: number;
        paid_amount?: number;
        balance_due?: number;
      }
    | {
        folio_code?: string;
        payment_status?: string;
        total_amount?: number;
        paid_amount?: number;
        balance_due?: number;
      }[]
    | null;
};

type ReservationGuestRow = {
  beds?: { bed_number?: number } | { bed_number?: number }[] | null;
  locker_number?: number | null;
  locker_days?: number | null;
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
    const lockerDays = Number(row.locker_days ?? 0);
    if (lockerDays > 0) stay.lockerDays = lockerDays;
    if (folio?.folio_code) stay.folioCode = folio.folio_code;
    if (folio?.payment_status) stay.paymentStatus = folio.payment_status;
    if (folio?.total_amount != null) stay.totalAmount = Number(folio.total_amount);
    if (folio?.paid_amount != null) stay.paidAmount = Number(folio.paid_amount);
    if (folio?.balance_due != null) stay.balanceDue = Number(folio.balance_due);
    return [stay];
  });
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("guests");
  const profile = await getSessionProfile();

  if (profile.role === "reception") {
    return <ReceptionGuestRosterPage searchParams={searchParams} />;
  }

  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  const supabase = createAdminClient();

  let query = supabase
    .from("guests")
    .select(
      "id,full_name,phone,email,created_at,reservation_guests!inner(beds(bed_number),locker_number,locker_days,reservations(check_in_date,check_out_date,nights,status,reservation_source,folios(folio_code,payment_status,total_amount,paid_amount,balance_due)))",
      { count: "exact" },
    );

  if (q) {
    const safe = escapeIlike(q);
    query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data: guestsRaw, count } = await query
    .order("full_name", { ascending: true })
    .range(from, to);

  const guestsWithStays = ((guestsRaw ?? []) as GuestRecord[])
    .map((guest) => ({ guest, stays: getStays(guest) }))
    .filter(({ stays }) => stays.length > 0);

  const rows = guestsWithStays.map(({ guest, stays }) => {
    const latest = stays.reduce((best, stay) => (stay.checkIn > best.checkIn ? stay : best), stays[0]);
    const totalNights = stays.reduce((sum, stay) => sum + stay.nights, 0);
    const totalLockerDays = stays.reduce((sum, stay) => sum + (stay.lockerDays ?? 0), 0);

    const filterText = [
      guest.full_name,
      guest.phone,
      guest.email,
      latest.folioCode,
      latest.paymentStatus,
      latest.paidAmount != null ? String(latest.paidAmount) : "",
      latest.totalAmount != null ? String(latest.totalAmount) : "",
      String(stays.length),
      String(totalNights),
      totalLockerDays > 0 ? String(totalLockerDays) : "",
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
        latest.folioCode ?? "",
        <GuestFolioCell key={`folio-${guest.id}`} folioCode={latest.folioCode} />,
      ),
      ft(
        `${latest.paymentStatus ?? ""} ${latest.paidAmount ?? 0} ${latest.totalAmount ?? 0} ${latest.balanceDue ?? 0}`,
        <GuestPaymentCell
          key={`payment-${guest.id}`}
          paymentStatus={latest.paymentStatus}
          totalAmount={latest.totalAmount}
          paidAmount={latest.paidAmount}
          balanceDue={latest.balanceDue}
        />,
      ),
      ft(
        `${stays.length} estadías ${totalNights} noches${totalLockerDays > 0 ? ` locker ${totalLockerDays}` : ""}`,
        <GuestStatsCell
          key={`stats-${guest.id}`}
          stayCount={stays.length}
          totalNights={totalNights}
          totalLockerDays={totalLockerDays}
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
          Personas con al menos una estadía. Folio y pago de la visita más reciente; expande el historial para ver
          estadías anteriores.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          <span className="font-medium text-text-main">{count ?? 0}</span> huéspedes con estadía registrada.
        </p>
      </Card>

      <ResponsiveTable
        headers={["Huésped", "Teléfono", "Folio", "Pago", "Resumen", "Última visita", "Alta"]}
        rows={rows}
        filterMode="global"
        dense
        serverPagination={{
          page,
          pageSize,
          totalCount: count ?? 0,
          searchQuery: q,
          searchPlaceholder: "Buscar por nombre, teléfono, email o folio…",
        }}
      />
    </div>
  );
}
