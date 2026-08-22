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
  ADMIN_GUESTS_COLUMNS,
  ADMIN_GUESTS_SORT_KEYS,
  formatRosterDateTime,
} from "@/lib/reception-guest-roster";
import { compareByDirection, parseTableSort } from "@/lib/table-controls";
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

type FolioFields = {
  folio_code?: string;
  payment_status?: string;
  total_amount?: number;
  paid_amount?: number;
  balance_due?: number;
};

type GuestFields = {
  id?: string;
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  created_at?: string;
};

type ReservationGuestRow = {
  locker_number?: string | number | null;
  locker_days?: number | null;
  guests?: GuestFields | GuestFields[] | null;
  beds?:
    | { bed_number?: string | number; zone?: string }
    | { bed_number?: string | number; zone?: string }[]
    | null;
  reservations?:
    | {
        id?: string;
        created_at?: string;
        check_in_date?: string;
        check_out_date?: string;
        nights?: number;
        status?: string;
        reservation_source?: string;
        notes?: string | null;
        folios?: FolioFields | FolioFields[] | null;
      }
    | {
        id?: string;
        created_at?: string;
        check_in_date?: string;
        check_out_date?: string;
        nights?: number;
        status?: string;
        reservation_source?: string;
        notes?: string | null;
        folios?: FolioFields | FolioFields[] | null;
      }[]
    | null;
};

type GuestAggregate = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  stays: GuestStaySummary[];
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

function toStay(row: ReservationGuestRow): GuestStaySummary | null {
  const reservation = unwrap(row.reservations);
  if (!reservation?.check_in_date) return null;

  const bed = unwrap(row.beds);
  const folio = unwrap(reservation.folios);
  const stay: GuestStaySummary = {
    checkIn: reservation.check_in_date,
    checkOut: reservation.check_out_date ?? "—",
    nights: reservation.nights ?? 0,
    source: reservation.reservation_source ?? "guest_app",
    reservationNotes: reservation.notes?.trim() || null,
    createdAt: reservation.created_at,
    reservationId: reservation.id,
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
  return stay;
}

function aggregateGuests(rows: ReservationGuestRow[]): GuestAggregate[] {
  const byGuest = new Map<string, GuestAggregate>();

  for (const row of rows) {
    const guest = unwrap(row.guests);
    if (!guest?.id || !guest.full_name || !guest.created_at) continue;

    const stay = toStay(row);
    if (!stay) continue;

    const existing = byGuest.get(guest.id);
    if (existing) {
      existing.stays.push(stay);
      continue;
    }

    byGuest.set(guest.id, {
      id: guest.id,
      full_name: guest.full_name,
      phone: guest.phone ?? null,
      email: guest.email ?? null,
      created_at: guest.created_at,
      stays: [stay],
    });
  }

  return Array.from(byGuest.values());
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
  const { page, pageSize } = parsePagination(params);
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
  const { column: sortColumn, direction: sortDirection } = parseTableSort(
    params,
    ADMIN_GUESTS_SORT_KEYS,
    "alta",
    "desc",
  );

  // Misma forma de join que el listado de recepción (reservation_guests → guests/reservations),
  // que sí resuelve nombres. Filtramos periodo en JS para conservar el historial completo.
  const { data: guestRows, error } = await supabase
    .from("reservation_guests")
    .select(
      `locker_number, locker_days,
      guests!inner(id, full_name, phone, email, created_at),
      beds(bed_number, zone),
      reservations!inner(
        id, created_at, check_in_date, check_out_date, nights, status, reservation_source, notes,
        folios(folio_code, payment_status, total_amount, paid_amount, balance_due)
      )`,
    )
    .neq("reservations.status", "cancelled")
    .limit(5000);

  if (error) {
    throw new Error(`No se pudo cargar el listado de huéspedes: ${error.message}`);
  }

  const guestsWithStays = aggregateGuests((guestRows ?? []) as ReservationGuestRow[])
    .map((guest) => ({ guest, stays: guest.stays }))
    .filter(({ stays }) =>
      periodBounds
        ? stays.some(
            (stay) =>
              stay.checkIn >= periodBounds.start && stay.checkIn <= periodBounds.end,
          )
        : stays.length > 0,
    )
    .map(({ guest, stays }) => ({
      guest,
      stays,
      latest: stays.reduce((best, stay) => {
        const byCreated = (stay.createdAt ?? "").localeCompare(best.createdAt ?? "");
        if (byCreated !== 0) return byCreated > 0 ? stay : best;
        const byReservation = (stay.reservationId ?? "").localeCompare(best.reservationId ?? "");
        if (byReservation !== 0) return byReservation > 0 ? stay : best;
        return stay.checkIn > best.checkIn ? stay : best;
      }, stays[0]),
    }))
    .sort((a, b) => {
      const byColumn = (() => {
        switch (sortColumn) {
          case "huesped":
            return compareByDirection(a.guest.full_name, b.guest.full_name, sortDirection);
          case "telefono":
            return compareByDirection(a.guest.phone ?? "", b.guest.phone ?? "", sortDirection);
          case "folio":
            return compareByDirection(a.latest.folioCode ?? "", b.latest.folioCode ?? "", sortDirection);
          case "pago":
            return compareByDirection(
              a.latest.paymentStatus ?? "",
              b.latest.paymentStatus ?? "",
              sortDirection,
            );
          case "resumen":
            return compareByDirection(a.stays.length, b.stays.length, sortDirection);
          case "visita":
            return compareByDirection(a.latest.checkIn, b.latest.checkIn, sortDirection);
          case "alta":
          default:
            return compareByDirection(a.latest.createdAt ?? "", b.latest.createdAt ?? "", sortDirection);
        }
      })();
      if (byColumn !== 0) return byColumn;
      const byReservation = (b.latest.reservationId ?? "").localeCompare(a.latest.reservationId ?? "");
      if (byReservation !== 0) return byReservation;
      return a.guest.full_name.localeCompare(b.guest.full_name, "es-MX");
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
      ft(
        latest.createdAt ? formatRosterDateTime(latest.createdAt) : guest.created_at,
        <span className="whitespace-nowrap tabular-nums">
          {latest.createdAt
            ? formatRosterDateTime(latest.createdAt)
            : new Date(guest.created_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}
        </span>,
      ),
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
        columns={ADMIN_GUESTS_COLUMNS}
        rows={rows}
        dense
        serverPagination={{
          page,
          pageSize,
          totalCount,
        }}
        serverSort={{ column: sortColumn, direction: sortDirection }}
      />
    </div>
  );
}
