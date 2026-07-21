import { Suspense } from "react";
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
import { requireModulePermission } from "@/lib/auth/guards";
import { ReceptionGuestRosterPage } from "@/components/dashboard/reception-guest-roster-page";
import { GuestDeleteButton } from "@/components/dashboard/guest-delete-button";
import {
  GuestsPeriodFilter,
  type GuestPeriod,
} from "@/components/dashboard/guests-period-filter";
import { parsePagination, getRange } from "@/lib/pagination";
import {
  financeMonthKeyToAnchorDate,
  getFinanceDayOptions,
  getFinanceMonthOptions,
  getFinanceWeekOptions,
  getMexicoCityDateString,
  getReservationPeriodBounds,
  parseFinanceDayKey,
  parseFinanceMonthKey,
  parseFinanceWeekAnchor,
} from "@/lib/dates";

type ReservationInfo = {
  check_in_date?: string;
  check_out_date?: string;
  nights?: number;
  status?: string;
  reservation_source?: string;
  notes?: string | null;
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
  beds?:
    | { bed_number?: string | number; zone?: string }
    | { bed_number?: string | number; zone?: string }[]
    | null;
  locker_number?: string | number | null;
  locker_days?: number | null;
  reservations?: ReservationInfo | ReservationInfo[] | null;
};

type GuestRecord = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  reservation_guests?: ReservationGuestRow[] | null;
};

function parseGuestPeriod(value: string | string[] | undefined): GuestPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "day" || raw === "week" || raw === "month" || raw === "all") return raw;
  return "all";
}

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
      reservationNotes: reservation.notes?.trim() || null,
    };
    if (bed?.bed_number != null) stay.bedNumber = bed.bed_number;
    if (bed?.zone != null) stay.bedZone = bed.zone;
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
  const profile = await requireModulePermission("guests");

  if (profile.role === "reception") {
    return <ReceptionGuestRosterPage searchParams={searchParams} />;
  }

  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);
  const today = getMexicoCityDateString();
  const period = parseGuestPeriod(params.guestPeriod);
  const selectedMonth = parseFinanceMonthKey(params.financeMonth, today);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const selectedDay = parseFinanceDayKey(params.financeDay, selectedMonth, today);
  const selectedWeek = parseFinanceWeekAnchor(params.financeWeek, selectedMonth, today);
  const periodAnchor =
    period === "day" ? selectedDay : period === "week" ? selectedWeek : monthAnchor;
  const periodBounds =
    period === "all" ? null : getReservationPeriodBounds(period, periodAnchor);
  const periodLabel = periodBounds?.label ?? "histórico completo";
  const monthOptions = getFinanceMonthOptions(24, today);
  const dayOptions = getFinanceDayOptions(selectedMonth);
  const weekOptions = getFinanceWeekOptions(selectedMonth);

  const supabase = createAdminClient();

  const { data: guestsRaw } = await supabase
    .from("guests")
    .select(
      "id,full_name,phone,email,created_at,reservation_guests!inner(beds(bed_number, zone),locker_number,locker_days,reservations(check_in_date,check_out_date,nights,status,reservation_source,notes,folios(folio_code,payment_status,total_amount,paid_amount,balance_due)))",
    )
    .limit(1000);

  const guestsWithStays = ((guestsRaw ?? []) as GuestRecord[])
    .map((guest) => ({ guest, stays: getStays(guest) }))
    .filter(({ stays }) =>
      periodBounds
        ? stays.some(
            (stay) =>
              stay.checkIn >= periodBounds.start &&
              stay.checkIn <= periodBounds.end,
          )
        : stays.length > 0,
    )
    .map(({ guest, stays }) => ({
      guest,
      stays,
      latest: stays.reduce((best, stay) => (stay.checkIn > best.checkIn ? stay : best), stays[0]),
    }))
    .filter(({ guest, stays, latest }) => {
      if (!q) return true;
      const needle = q.toLocaleLowerCase("es-MX");
      return [
        guest.full_name,
        guest.phone,
        guest.email,
        ...stays.flatMap((stay) => [
          stay.folioCode,
          stay.paymentStatus,
          stay.checkIn,
          stay.checkOut,
        ]),
        latest.folioCode,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("es-MX").includes(needle));
    })
    .sort((a, b) => {
      const byLatestStay = b.latest.checkIn.localeCompare(a.latest.checkIn);
      return byLatestStay || a.guest.full_name.localeCompare(b.guest.full_name, "es-MX");
    });

  const totalCount = guestsWithStays.length;
  const pagedGuests = guestsWithStays.slice(from, to + 1);

  const rows = pagedGuests.map(({ guest, stays, latest }) => {
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
      ft(
        guest.phone ?? "",
        <span className="whitespace-nowrap tabular-nums">{guest.phone ?? "—"}</span>,
      ),
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
      ft(
        "eliminar",
        <GuestDeleteButton
          key={`delete-${guest.id}`}
          guestId={guest.id}
          guestName={guest.full_name}
          stayCount={stays.length}
        />,
      ),
    ];
  });

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Huéspedes</h2>
        <p className="mt-1 text-sm text-text-muted">
          Personas con al menos una estadía iniciada en el periodo. El resumen, folio y pago corresponden al
          historial completo de cada huésped. Eliminar borra también folios y pagos de ese huésped.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          <span className="font-medium text-text-main">{totalCount}</span> huéspedes en {periodLabel}.
        </p>
        <div className="mt-4 border-t border-border-soft pt-4">
          <Suspense fallback={<p className="text-sm text-text-muted">Cargando filtro…</p>}>
            <GuestsPeriodFilter
              period={period}
              periodLabel={periodLabel}
              selectedMonth={selectedMonth}
              selectedDay={selectedDay}
              selectedWeek={selectedWeek}
              monthOptions={monthOptions}
              dayOptions={dayOptions}
              weekOptions={weekOptions}
            />
          </Suspense>
        </div>
      </Card>

      <ResponsiveTable
        headers={["Huésped", "Teléfono", "Folio", "Pago", "Resumen", "Última visita", "Alta", ""]}
        rows={rows}
        filterMode="global"
        dense
        serverPagination={{
          page,
          pageSize,
          totalCount,
          searchQuery: q,
          searchPlaceholder: "Buscar por nombre, teléfono, email o folio…",
        }}
      />
    </div>
  );
}
