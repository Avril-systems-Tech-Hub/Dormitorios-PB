import Link from "next/link";
import { ReservationGuestsAccordion } from "@/components/ui/reservation-guests-accordion";
import {
  formatBedLockerLabel,
  ReservationNightsCell,
  sumLockerDays,
} from "@/components/ui/reservation-nights-cell";
import { ReservationPaymentInline } from "@/components/ui/reservation-payment-inline";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";

type ActiveReservationsPanelProps = {
  compact?: boolean;
  limit?: number;
};

export async function ActiveReservationsPanel({
  compact = false,
  limit = 40,
}: ActiveReservationsPanelProps = {}) {
  const adminSupabase = createAdminClient();
  const fetchLimit = compact ? limit : 40;

  const { data: reservations } = await adminSupabase
    .from("reservations")
    .select(
      "id,created_at,status,reservation_source,check_in_date,check_out_date,nights,notes,profiles(full_name),folios(id,folio_code,payment_status,balance_due,total_amount),reservation_guests(guest_id,locker_number,locker_days,guests(full_name,phone,email),beds(bed_number))",
    )
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  const allReservations = reservations ?? [];
  const displayedReservations = compact ? allReservations.slice(0, limit) : allReservations;

  const paidCount = allReservations.filter((r) => {
    const folio = r.folios as { payment_status?: string } | undefined;
    return folio?.payment_status === "liquidated";
  }).length;

  const tableRows = displayedReservations.map((reservation) => {
    const allGuests = Array.isArray(reservation.reservation_guests)
      ? reservation.reservation_guests
      : [];
    const assignment = allGuests[0] ?? null;
    const guest = assignment?.guests as { full_name?: string; phone?: string } | undefined;
    const bed = assignment?.beds as { bed_number?: number } | undefined;
    const assignmentLocker = assignment as
      | { locker_number?: number | null; locker_days?: number | null }
      | null;
    const bedLockerLabel = formatBedLockerLabel(
      bed?.bed_number,
      assignmentLocker?.locker_number,
      assignmentLocker?.locker_days,
    );
    const folio = reservation.folios as {
      id?: string;
      folio_code?: string;
      balance_due?: number;
      total_amount?: number;
      payment_status?: string;
    } | undefined;

    const lockerDays = sumLockerDays(allGuests);
    const nightsLabel = `${reservation.nights} noche(s)`;
    const nightsFilterText =
      lockerDays > 0 ? `${nightsLabel} Locker ${lockerDays} día(s)` : nightsLabel;

    return [
      ft(
        folio?.folio_code ?? "Sin folio",
        <div key={`f-${reservation.id}`}>
          <span>{folio?.folio_code ?? "Sin folio"}</span>
          <ReservationGuestsAccordion
            guests={allGuests}
            reservationId={reservation.id}
            nights={reservation.nights}
            returnTo="/dashboard"
          />
        </div>,
      ),
      guest?.full_name ?? "Sin huésped",
      guest?.phone ?? "-",
      bedLockerLabel,
      `${reservation.check_in_date} → ${reservation.check_out_date}`,
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
          <Badge key={`s-${reservation.id}`} variant="warning">
            Caja
          </Badge>
        ) : (
          <Badge key={`s-${reservation.id}`} variant="success">
            App cliente
          </Badge>
        ),
      ),
      ft(
        folio?.payment_status ?? "pending",
        <Badge
          key={`p-${reservation.id}`}
          variant={folio?.payment_status === "liquidated" ? "success" : "warning"}
        >
          {folio?.payment_status ?? "pending"}
        </Badge>,
      ),
      `$${Number(folio?.total_amount ?? 0).toFixed(2)}`,
      `$${Number(folio?.balance_due ?? 0).toFixed(2)}`,
      folio?.id ? (
        <ReservationPaymentInline
          key={`pay-${reservation.id}`}
          folioId={folio.id}
          folioCode={folio.folio_code ?? ""}
          balanceDue={Number(folio.balance_due ?? 0)}
          totalAmount={Number(folio.total_amount ?? 0)}
          paymentStatus={folio.payment_status ?? "pending"}
        />
      ) : (
        <span key={`np-${reservation.id}`} className="text-xs text-red-600">
          Sin folio
        </span>
      ),
    ];
  });

  return (
    <>
      {!compact ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <Card>
            <p className="text-sm text-text-muted">Reservaciones activas</p>
            <p className="mt-1 text-2xl font-semibold">{allReservations.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-text-muted">Pagadas</p>
            <p className="mt-1 text-2xl font-semibold">{paidCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-text-muted">No pagadas</p>
            <p className="mt-1 text-2xl font-semibold">{allReservations.length - paidCount}</p>
          </Card>
        </div>
      ) : null}

      <Card className="min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-text-main">Reservaciones activas</h2>
            <p className="mt-1 text-sm text-text-muted">
              Control de check-in, cama asignada y cobro por folio.
            </p>
          </div>
          {compact ? (
            <Link
              href="/dashboard/reservations"
              className="shrink-0 text-sm text-brand-primary underline"
            >
              Ver todas
            </Link>
          ) : null}
        </div>
        <div className="mt-3">
          <ResponsiveTable
            headers={[
              "Folio",
              "Huésped",
              "Teléfono",
              "Cama",
              "Fechas",
              "Noches",
              "Creada",
              "Origen",
              "Pago",
              "Total",
              "Saldo",
              "Cobro",
            ]}
            rows={tableRows}
            mobileColumnIndices={[0, 1, 3, 4, 10, 11]}
          />
        </div>
      </Card>
    </>
  );
}
