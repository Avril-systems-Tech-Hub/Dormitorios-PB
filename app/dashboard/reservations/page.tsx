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
import { ReservationsPeriodFilter } from "@/components/dashboard/reservations-period-filter";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";
import {
  financeMonthKeyToAnchorDate,
  getFinanceMonthOptions,
  getMexicoCityDateString,
  getReservationPeriodBounds,
  parseFinanceMonthKey,
  parseReservationPeriod,
} from "@/lib/dates";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);
  const period = parseReservationPeriod(params.period);
  const today = getMexicoCityDateString();
  const selectedMonth = parseFinanceMonthKey(params.financeMonth, today);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const monthOptions = getFinanceMonthOptions(24, today);
  const periodAnchor = period === "month" ? monthAnchor : today;
  const periodBounds = getReservationPeriodBounds(period, periodAnchor);

  const supabase = createAdminClient();

  let query = supabase
    .from("reservations")
    .select(
      "id,created_at,status,reservation_source,check_in_date,check_out_date,nights,notes,profiles(full_name),folios!inner(id,folio_code,payment_status,balance_due,total_amount),reservation_guests(guest_id,locker_number,locker_days,guests(full_name,phone,email),beds(bed_number))",
      { count: "exact" },
    )
    .gte("created_at", periodBounds.startAt)
    .lte("created_at", periodBounds.endAt);

  if (q) {
    query = query.ilike("folios.folio_code", `%${escapeIlike(q)}%`);
  }

  const { data: reservations, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows =
    reservations?.map((reservation) => {
      const allGuests = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests : [];
      const assignment = allGuests[0] ?? null;
      const guest = assignment?.guests as { full_name?: string; phone?: string } | undefined;
      const folio = reservation.folios as {
        id?: string;
        folio_code?: string;
        payment_status?: string;
        balance_due?: number;
        total_amount?: number;
      } | undefined;

      const profile = reservation.profiles as { full_name?: string } | undefined;
      const lockerDays = sumLockerDays(allGuests);
      const nightsLabel = `${reservation.nights} noche(s)`;
      const nightsFilterText =
        lockerDays > 0 ? `${nightsLabel} Locker ${lockerDays} día(s)` : nightsLabel;

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
            />
          </div>,
        ),
        guest?.full_name ?? "Sin huésped",
        guest?.phone ?? "-",
        ft(
          allGuests.map((g) => {
            const bed = (Array.isArray(g.beds) ? g.beds[0] : g.beds) as { bed_number?: number } | undefined;
            return bed?.bed_number ? `Cama ${bed.bed_number}` : "Pendiente";
          }).join(" "),
          <GuestAssignmentCell
            key={`assign-${reservation.id}`}
            guests={allGuests}
            reservationId={reservation.id}
            nights={reservation.nights}
            returnTo="/dashboard/reservations"
          />,
        ),
        `${reservation.check_in_date} -> ${reservation.check_out_date}`,
        ft(
          nightsFilterText,
          <ReservationNightsCell
            key={`nights-${reservation.id}`}
            nights={reservation.nights}
            lockerDays={lockerDays}
          />,
        ),
        reservation.created_at
          ? new Date(reservation.created_at).toLocaleString("es-MX", {
              timeZone: "America/Mexico_City",
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        ft(
          reservation.reservation_source === "cashier_counter" ? "Caja" : "App cliente",
          reservation.reservation_source === "cashier_counter" ? (
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
      ];
    }) ?? [];

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Reservaciones activas</h2>
        <p className="mt-1 text-sm text-text-muted">
          Control de check-in, cama asignada y estado de pago por folio.
        </p>
        <div className="mt-4 border-t border-border-soft pt-4">
          <Suspense fallback={<p className="text-sm text-text-muted">Cargando filtro…</p>}>
            <ReservationsPeriodFilter
              period={period}
              periodLabel={periodBounds.label}
              selectedMonth={selectedMonth}
              monthOptions={monthOptions}
            />
          </Suspense>
        </div>
      </Card>
      <ResponsiveTable
        headers={[
          "Folio",
          "Huésped",
          "Teléfono",
          "Cama / Locker",
          "Fechas",
          "Noches",
          "Creada",
          "Origen",
          "Pago",
          "Total",
          "Saldo",
          "Cobrar",
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
