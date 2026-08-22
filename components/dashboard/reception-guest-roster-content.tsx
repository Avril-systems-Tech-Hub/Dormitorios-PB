import { Suspense } from "react";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { ReservationsPeriodFilter } from "@/components/dashboard/reservations-period-filter";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatGuestSexLabel } from "@/lib/guest-sex-label";
import { formatBedLabel } from "@/lib/beds";
import { normalizeLockerCode } from "@/lib/locker";
import {
  computeGuestLineTotal,
  formatRosterDate,
  formatRosterDay,
  formatRosterTime,
} from "@/lib/reception-guest-roster";
import {
  financeMonthKeyToAnchorDate,
  getFinanceMonthOptions,
  getMexicoCityDateString,
  getReservationPeriodBounds,
  parseFinanceMonthKey,
  parseReservationPeriod,
  type ReservationPeriod,
} from "@/lib/dates";
import { reservationHasPendingCheckout } from "@/lib/bed-occupancy";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";
import { RegisterCheckoutButton } from "@/components/ui/register-checkout-button";
import { ReservationPaymentInline } from "@/components/ui/reservation-payment-inline";
import { ReceptionGuestEditButton } from "@/components/dashboard/reception-guest-edit-button";
import { Badge } from "@/components/ui/badge";

type FolioFields = {
  id?: string;
  folio_code?: string;
  total_amount?: number;
  paid_amount?: number;
  balance_due?: number;
  payment_status?: string;
};

type ReservationGuestRow = {
  id: string;
  guest_id: string;
  bed_id: string | null;
  locker_number: string | number | null;
  locker_days: number | null;
  final_rate: number | null;
  locker_amount: number | null;
  guests:
    | { id?: string; full_name?: string; phone?: string | null; sex?: string }
    | { id?: string; full_name?: string; phone?: string | null; sex?: string }[]
    | null;
  beds: { bed_number?: string | number; zone?: string } | { bed_number?: string | number; zone?: string }[] | null;
  reservations:
    | {
        id?: string;
        created_at?: string;
        check_in_date?: string;
        check_out_date?: string;
        nights?: number;
        status?: string;
        checked_out_at?: string | null;
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
        checked_out_at?: string | null;
        notes?: string | null;
        folios?: FolioFields | FolioFields[] | null;
      }[]
    | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseRosterPeriod(
  params: Record<string, string | string[] | undefined>,
  paramPrefix?: string,
): ReservationPeriod {
  const key = paramPrefix ? `${paramPrefix}_period` : "period";
  const fallback = paramPrefix ? "day" : "month";
  const raw = pickFirst(params[key]) || fallback;
  return parseReservationPeriod(raw);
}

function parseRosterMonthKey(
  params: Record<string, string | string[] | undefined>,
  today: string,
  paramPrefix?: string,
): string {
  const key = paramPrefix ? `${paramPrefix}_financeMonth` : "financeMonth";
  return parseFinanceMonthKey(params[key] ?? params.financeMonth, today);
}

export function rosterParamsActive(
  params: Record<string, string | string[] | undefined>,
  paramPrefix = "roster",
): boolean {
  const p = `${paramPrefix}_`;
  return Boolean(
    params[`${p}page`] ||
      params[`${p}q`] ||
      params[`${p}period`] ||
      params[`${p}financeMonth`] ||
      params[`${p}pageSize`],
  );
}

type ReceptionGuestRosterContentProps = {
  searchParams: Record<string, string | string[] | undefined>;
  basePath?: string;
  paramPrefix?: string;
  embedded?: boolean;
};

export async function ReceptionGuestRosterContent({
  searchParams,
  basePath = "/dashboard/guests",
  paramPrefix,
  embedded = false,
}: ReceptionGuestRosterContentProps) {
  const { page, pageSize, q } = parsePagination(searchParams, paramPrefix);
  const [from, to] = getRange(page, pageSize);
  const period = parseRosterPeriod(searchParams, paramPrefix);
  const today = getMexicoCityDateString();
  const selectedMonth = parseRosterMonthKey(searchParams, today, paramPrefix);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const monthOptions = getFinanceMonthOptions(24, today);
  const periodAnchor = period === "month" ? monthAnchor : today;
  const periodBounds = getReservationPeriodBounds(period, periodAnchor);

  const supabase = createAdminClient();

  let query = supabase
    .from("reservation_guests")
    .select(
      `id, guest_id, bed_id, locker_number, locker_days, final_rate, locker_amount,
      guests!inner(id, full_name, phone, sex),
      beds(bed_number, zone),
      reservations!inner(id, created_at, check_in_date, check_out_date, nights, status, checked_out_at, notes, folios!inner(id, folio_code, total_amount, paid_amount, balance_due, payment_status))`,
      { count: "exact" },
    )
    .neq("reservations.status", "cancelled")
    .gte("reservations.check_in_date", periodBounds.start)
    .lte("reservations.check_in_date", periodBounds.end);

  if (q) {
    const safe = escapeIlike(q);
    query = query.or(
      `guests.full_name.ilike.%${safe}%,reservations.folios.folio_code.ilike.%${safe}%`,
    );
  }

  const { data: guestRows, count } = await query
    .order("created_at", { ascending: false, foreignTable: "reservations" })
    .order("id", { ascending: false })
    .range(from, to);

  const rows = ((guestRows ?? []) as ReservationGuestRow[]).map((row) => {
    const guest = unwrap(row.guests);
    const bed = unwrap(row.beds);
    const reservation = unwrap(row.reservations);
    const folio = unwrap(reservation?.folios);
    const nights = Number(reservation?.nights ?? 0);
    const finalRate = Number(row.final_rate ?? 0);
    const lockerAmount = Number(row.locker_amount ?? 0);
    const lineTotal = computeGuestLineTotal(nights, finalRate, lockerAmount);
    const checkIn = reservation?.check_in_date ?? "";
    const checkOut = reservation?.check_out_date ?? "";
    const createdAt = reservation?.created_at ?? "";
    const folioCode = folio?.folio_code ?? "—";
    const guestName = guest?.full_name ?? "—";
    const bedNumber = formatBedLabel(bed?.bed_number, bed?.zone) ?? "—";
    const lockerNumber = normalizeLockerCode(row.locker_number) ?? "—";
    const sexLabel = formatGuestSexLabel(guest?.sex);
    const dayLabel = checkIn ? formatRosterDay(checkIn) : "—";
    const checkInLabel = checkIn ? formatRosterDate(checkIn) : "—";
    const checkOutLabel = checkOut ? formatRosterDate(checkOut) : "—";
    const timeLabel = createdAt ? formatRosterTime(createdAt) : "—";
    const totalLabel = `$${lineTotal.toFixed(2)}`;
    const balanceDue = Number(folio?.balance_due ?? 0);
    const paidAmount = Number(folio?.paid_amount ?? 0);
    const folioTotal = Number(folio?.total_amount ?? lineTotal);
    const paymentStatus = folio?.payment_status ?? "pending";
    const reservationNotes = reservation?.notes?.trim() || null;
    const isCheckedOut = Boolean(reservation?.checked_out_at) || reservation?.status === "checked_out";
    const pendingCheckout = reservation
      ? reservationHasPendingCheckout(reservation)
      : false;
    const canCheckout =
      !isCheckedOut &&
      reservation?.status !== "cancelled" &&
      Boolean(checkIn && checkIn <= today && reservation?.id);

    const filterText = [
      dayLabel,
      guestName,
      folioCode,
      sexLabel,
      bedNumber,
      lockerNumber,
      checkInLabel,
      timeLabel,
      checkOutLabel,
      String(nights),
      totalLabel,
      paymentStatus,
      String(balanceDue),
      reservationNotes ?? "",
    ].join(" ");

    return [
      ft(filterText, <span className="tabular-nums">{dayLabel}</span>),
      ft(guestName, <span className="font-medium text-text-main">{guestName}</span>),
      ft(folioCode, <span className="whitespace-nowrap">{folioCode}</span>),
      ft(sexLabel, sexLabel),
      ft(bedNumber, <span className="tabular-nums">{bedNumber}</span>),
      ft(lockerNumber, <span className="tabular-nums">{lockerNumber}</span>),
      ft(checkInLabel, <span className="whitespace-nowrap tabular-nums">{checkInLabel}</span>),
      ft(timeLabel, <span className="whitespace-nowrap tabular-nums">{timeLabel}</span>),
      ft(checkOutLabel, <span className="whitespace-nowrap tabular-nums">{checkOutLabel}</span>),
      ft(String(nights), <span className="tabular-nums">{nights}</span>),
      ft(totalLabel, <span className="whitespace-nowrap font-medium tabular-nums">{totalLabel}</span>),
      ft(
        `${paymentStatus} ${balanceDue} ${paidAmount}`,
        folio?.id ? (
          <ReservationPaymentInline
            folioId={folio.id}
            folioCode={folioCode}
            balanceDue={balanceDue}
            totalAmount={folioTotal}
            paymentStatus={paymentStatus}
            returnTo={basePath}
          />
        ) : (
          <span className="text-xs text-text-muted">—</span>
        ),
      ),
      ft(
        reservationNotes ?? "Sin nota",
        <span className="block max-w-64 whitespace-pre-wrap text-text-main">
          {reservationNotes ?? "Sin nota general."}
        </span>,
      ),
      ft(
        `${isCheckedOut ? "salida registrada" : pendingCheckout ? "salida pendiente" : "vigente"}`,
        <span className="inline-flex flex-col items-start gap-1.5">
          {isCheckedOut ? (
            <Badge variant="success">Salida registrada</Badge>
          ) : pendingCheckout ? (
            <Badge variant="warning">Salida pendiente</Badge>
          ) : (
            <Badge>Vigente</Badge>
          )}
          {canCheckout && reservation?.id ? (
            <RegisterCheckoutButton
              reservationId={reservation.id}
              balanceDue={balanceDue}
              compact
            />
          ) : null}
        </span>,
      ),
      ft(
        "editar",
        guest?.id && reservation?.id && row.guest_id ? (
          <ReceptionGuestEditButton
            reservationId={reservation.id}
            guestId={row.guest_id}
            fullName={guestName === "—" ? "" : guestName}
            phone={guest.phone ?? null}
            bedId={row.bed_id}
            lockerNumber={normalizeLockerCode(row.locker_number)}
            canEditAssignments={!isCheckedOut}
          />
        ) : (
          <span className="text-xs text-text-muted">—</span>
        ),
      ),
    ];
  });

  return (
    <div className={embedded ? "space-y-4" : "space-y-4"}>
      {!embedded ? (
        <>
          <h2 className="text-lg font-semibold text-text-main">Huéspedes</h2>
          <p className="mt-1 text-sm text-text-muted">
            Listado por persona y estadía ({periodBounds.label}). Una fila por huésped en cada
            reservación.
          </p>
        </>
      ) : null}

      <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-surface-soft" />}>
        <ReservationsPeriodFilter
          period={period}
          periodLabel={periodBounds.label}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          basePath={basePath}
          paramPrefix={paramPrefix}
        />
      </Suspense>

      <p className="text-sm text-text-muted">
        <span className="font-medium text-text-main">{count ?? 0}</span> registros ·{" "}
        {periodBounds.label}
      </p>

      <ResponsiveTable
        headers={[
          "Día",
          "Nombre",
          "Folio",
          "Sexo",
          "No. Cama",
          "No. Locker",
          "Fecha ingreso",
          "Hora",
          "Fecha salida",
          "Noches",
          "Total",
          "Pago / saldo",
          "Nota de reservación",
          "Estado / salida",
          "Editar",
        ]}
        rows={rows}
        filterMode="global"
        dense
        serverPagination={{
          page,
          pageSize,
          totalCount: count ?? 0,
          searchQuery: q,
          searchPlaceholder: "Buscar por nombre o folio…",
          paramPrefix,
        }}
      />
    </div>
  );
}
