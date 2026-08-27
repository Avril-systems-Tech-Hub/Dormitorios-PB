import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { ReservationGuestsAccordion } from "@/components/ui/reservation-guests-accordion";
import { GuestAssignmentCell } from "@/components/ui/guest-assignment-actions";
import {
  ReservationNightsCell,
  sumLockerDays,
} from "@/components/ui/reservation-nights-cell";
import { ReservationPaymentInline } from "@/components/ui/reservation-payment-inline";
import { RegisterCheckoutButton } from "@/components/ui/register-checkout-button";
import { ReservationsPeriodFilter } from "@/components/dashboard/reservations-period-filter";
import { GuestsPaymentFilter } from "@/components/dashboard/guests-payment-filter";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";
import {
  financeMonthKeyToAnchorDate,
  formatMexicoCityDateTime,
  getFinanceDayOptions,
  getFinanceMonthOptions,
  getFinanceWeekOptions,
  getMexicoCityDateString,
  getReservationPeriodBounds,
  parseFinanceDayKey,
  parseFinanceMonthKey,
  parseFinanceWeekAnchor,
  parseReservationPeriod,
} from "@/lib/dates";
import { parseGuestPaymentFilter } from "@/lib/guest-payment-filter";
import { reservationHasPendingCheckout, reservationIsInHouseNow } from "@/lib/bed-occupancy";
import { autoCloseLiquidatedStays } from "@/lib/auto-checkout";
import { requireModulePermission } from "@/lib/auth/guards";
import { formatBedLabel } from "@/lib/beds";

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("reservations");
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);
  const period = parseReservationPeriod(params.period);
  const paymentFilter = parseGuestPaymentFilter(params);
  const today = getMexicoCityDateString();
  const selectedMonth = parseFinanceMonthKey(params.financeMonth, today);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const selectedDay = parseFinanceDayKey(params.financeDay, selectedMonth, today);
  const selectedWeek = parseFinanceWeekAnchor(params.financeWeek, selectedMonth, today);
  const monthOptions = getFinanceMonthOptions(24, today);
  const dayOptions = getFinanceDayOptions(selectedMonth);
  const weekOptions = getFinanceWeekOptions(selectedMonth);
  const periodAnchor =
    period === "day" ? selectedDay : period === "week" ? selectedWeek : monthAnchor;
  const periodBounds = getReservationPeriodBounds(period, periodAnchor);

  const supabase = createAdminClient();
  await autoCloseLiquidatedStays();

  let query = supabase
    .from("reservations")
    .select(
      "id,created_at,status,checked_out_at,is_historical,reservation_source,check_in_date,check_out_date,nights,notes,profiles!reservations_created_by_fkey(full_name),folios!inner(id,folio_code,payment_status,balance_due,total_amount),reservation_guests(id,guest_id,locker_number,locker_days,guests(full_name,phone,email),beds(bed_number, zone))",
      { count: "exact" },
    )
    .gte("check_in_date", periodBounds.start)
    .lte("check_in_date", periodBounds.end);

  if (paymentFilter === "paid") {
    query = query.eq("folios.payment_status", "liquidated");
  } else if (paymentFilter === "debt") {
    query = query.neq("folios.payment_status", "liquidated");
  }

  if (q) {
    query = query.ilike("folios.folio_code", `%${escapeIlike(q)}%`);
  }

  const { data: reservations, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`No se pudieron cargar las reservaciones: ${error.message}`);
  }

  const rows =
    reservations?.map((reservation) => {
      const allGuests = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests : [];
      const assignment = allGuests[0] ?? null;
      const guest = unwrapRelation(
        assignment?.guests as
          | { full_name?: string; phone?: string }
          | { full_name?: string; phone?: string }[]
          | null
          | undefined,
      );
      const folio = unwrapRelation(
        reservation.folios as
          | {
              id?: string;
              folio_code?: string;
              payment_status?: string;
              balance_due?: number;
              total_amount?: number;
            }
          | {
              id?: string;
              folio_code?: string;
              payment_status?: string;
              balance_due?: number;
              total_amount?: number;
            }[]
          | null
          | undefined,
      );
      const profile = unwrapRelation(
        reservation.profiles as
          | { full_name?: string }
          | { full_name?: string }[]
          | null
          | undefined,
      );
      const lockerDays = sumLockerDays(allGuests);
      const nightsLabel = `${reservation.nights} noche(s)`;
      const nightsFilterText =
        lockerDays > 0 ? `${nightsLabel} Locker ${lockerDays} día(s)` : nightsLabel;
      const isCheckedOut = Boolean(reservation.checked_out_at) || reservation.status === "checked_out";
      const pendingCheckout = reservationHasPendingCheckout({
        status: reservation.status,
        checked_out_at: reservation.checked_out_at,
        check_out_date: reservation.check_out_date,
        payment_status: folio?.payment_status,
      });
      const canCheckout =
        !isCheckedOut &&
        reservation.status !== "cancelled" &&
        reservation.check_in_date <= today &&
        (pendingCheckout || reservationIsInHouseNow(reservation));

      return [
        ft(
          folio?.folio_code ?? "Sin folio",
          <div key={`folio-${reservation.id}`}>
            <span>{folio?.folio_code ?? "Sin folio"}</span>
            <ReservationGuestsAccordion
              guests={allGuests}
              reservationId={reservation.id}
              nights={reservation.nights}
              returnTo="/dashboard/reservations"
              readOnly={isCheckedOut || reservation.status === "cancelled"}
            />
          </div>,
        ),
        guest?.full_name ?? "Sin huésped",
        guest?.phone ?? "-",
        ft(
          allGuests.map((g) => {
            const bed = unwrapRelation(
              g.beds as
                | { bed_number?: string | number; zone?: string }
                | { bed_number?: string | number; zone?: string }[]
                | null
                | undefined,
            );
            return formatBedLabel(bed?.bed_number, bed?.zone) ?? "Pendiente";
          }).join(" "),
          <GuestAssignmentCell
            key={`assign-${reservation.id}`}
            guests={allGuests}
            reservationId={reservation.id}
            nights={reservation.nights}
            returnTo="/dashboard/reservations"
            readOnly={isCheckedOut || reservation.status === "cancelled"}
          />,
        ),
        `${reservation.check_in_date} -> ${reservation.check_out_date}`,
        ft(
          reservation.notes ?? "Sin nota",
          <div key={`notes-${reservation.id}`} className="max-w-64">
            <p className="whitespace-pre-wrap text-sm text-text-main">
              {reservation.notes?.trim() || "Sin nota general."}
            </p>
          </div>,
        ),
        ft(
          `${reservation.status} ${pendingCheckout ? "saldo pendiente" : ""}`,
          isCheckedOut ? (
            <Badge key={`${reservation.id}-stay`} variant="success">Salida registrada</Badge>
          ) : pendingCheckout ? (
            <Badge key={`${reservation.id}-stay`} variant="warning">Saldo pendiente</Badge>
          ) : reservation.status === "cancelled" ? (
            <Badge key={`${reservation.id}-stay`} variant="danger">Cancelada</Badge>
          ) : (
            <Badge key={`${reservation.id}-stay`}>Vigente</Badge>
          ),
        ),
        ft(
          nightsFilterText,
          <ReservationNightsCell
            key={`nights-${reservation.id}`}
            nights={reservation.nights}
            lockerDays={lockerDays}
          />,
        ),
        reservation.created_at ? formatMexicoCityDateTime(reservation.created_at) : "—",
        ft(
          reservation.is_historical
            ? "Histórica sin inventario"
            : reservation.reservation_source === "cashier_counter"
              ? "Caja"
              : "App cliente",
          reservation.is_historical ? (
            <Badge key={`${reservation.id}-src`} variant="warning">
              Histórica · sin cama
            </Badge>
          ) : reservation.reservation_source === "cashier_counter" ? (
            <Badge key={`${reservation.id}-src`} variant="warning">
              Caja ({profile?.full_name ?? "sin usuario"})
            </Badge>
          ) : (
            <Badge key={`${reservation.id}-src`} variant="success">
              App cliente
            </Badge>
          ),
        ),
        ft(
          folio?.payment_status ?? "pending",
          <Badge
            key={`${reservation.id}-pay`}
            variant={folio?.payment_status === "liquidated" ? "success" : "warning"}
          >
            {folio?.payment_status ?? "pending"}
          </Badge>
        ),
        folio?.total_amount ? `$${Number(folio.total_amount).toFixed(2)}` : "$0.00",
        folio?.balance_due ? `$${Number(folio.balance_due).toFixed(2)}` : "$0.00",
        folio?.id ? (
          <ReservationPaymentInline
            key={`pay-${reservation.id}`}
            folioId={folio.id}
            folioCode={folio.folio_code ?? ""}
            balanceDue={Number(folio.balance_due ?? 0)}
            totalAmount={Number(folio.total_amount ?? 0)}
            paymentStatus={folio.payment_status ?? "pending"}
            returnTo="/dashboard/reservations"
          />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
        canCheckout ? (
          <RegisterCheckoutButton
            key={`checkout-${reservation.id}`}
            reservationId={reservation.id}
            balanceDue={Number(folio?.balance_due ?? 0)}
            compact
          />
        ) : (
          <span className="text-xs text-text-muted">—</span>
        ),
      ];
    }) ?? [];

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Reservaciones y estancias</h2>
        <p className="mt-1 text-sm text-text-muted">
          Control de check-in, cama asignada y estado de pago por folio.
        </p>
        <div className="mt-4 space-y-3 border-t border-border-soft pt-4">
          <Suspense fallback={<p className="text-sm text-text-muted">Cargando filtro…</p>}>
            <ReservationsPeriodFilter
              period={period}
              periodLabel={periodBounds.label}
              selectedMonth={selectedMonth}
              selectedDay={selectedDay}
              selectedWeek={selectedWeek}
              monthOptions={monthOptions}
              dayOptions={dayOptions}
              weekOptions={weekOptions}
            />
          </Suspense>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-muted">
              Filtra por periodo y por estado de pago del folio (sin mezclar con cortes).
            </p>
            <Suspense fallback={null}>
              <GuestsPaymentFilter
                value={paymentFilter}
                basePath="/dashboard/reservations"
              />
            </Suspense>
          </div>
        </div>
      </Card>
      <ResponsiveTable
        headers={[
          "Folio",
          "Huésped",
          "Teléfono",
          "Cama / Locker",
          "Fechas",
          "Nota de reservación",
          "Estancia",
          "Noches",
          "Creada",
          "Origen",
          "Pago",
          "Total",
          "Saldo",
          "Cobrar",
          "Salida",
        ]}
        rows={rows}
        filterMode="global"
        serverPagination={{
          page,
          pageSize,
          totalCount: count ?? 0,
          searchQuery: q,
          searchPlaceholder: "Buscar por folio…",
        }}
      />
    </div>
  );
}
