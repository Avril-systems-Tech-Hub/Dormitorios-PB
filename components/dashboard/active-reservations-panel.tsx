import { ReservationGuestsAccordion } from "@/components/ui/reservation-guests-accordion";
import { ReservationPaymentInline } from "@/components/ui/reservation-payment-inline";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";

export async function ActiveReservationsPanel() {
  const adminSupabase = createAdminClient();

  const { data: reservations } = await adminSupabase
    .from("reservations")
    .select(
      "id,created_at,status,reservation_source,check_in_date,check_out_date,nights,notes,profiles(full_name),folios(id,folio_code,payment_status,balance_due,total_amount),reservation_guests(guest_id,guests(full_name,phone,email),beds(bed_number))",
    )
    .order("created_at", { ascending: false })
    .limit(40);

  const paidCount = (reservations ?? []).filter((r) => {
    const folio = r.folios as { payment_status?: string } | undefined;
    return folio?.payment_status === "liquidated";
  }).length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-text-muted">Reservaciones activas</p>
          <p className="mt-1 text-2xl font-semibold">{(reservations ?? []).length}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Pagadas</p>
          <p className="mt-1 text-2xl font-semibold">{paidCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">No pagadas</p>
          <p className="mt-1 text-2xl font-semibold">{(reservations ?? []).length - paidCount}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-text-main">Reservaciones activas</h2>
        <p className="mt-1 text-sm text-text-muted">Control de check-in, cama asignada y cobro por folio.</p>
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
            rows={(reservations ?? []).map((reservation) => {
              const allGuests = Array.isArray(reservation.reservation_guests)
                ? reservation.reservation_guests
                : [];
              const assignment = allGuests[0] ?? null;
              const guest = assignment?.guests as { full_name?: string; phone?: string } | undefined;
              const bed = assignment?.beds as { bed_number?: number } | undefined;
              const folio = reservation.folios as {
                id?: string;
                folio_code?: string;
                balance_due?: number;
                total_amount?: number;
                payment_status?: string;
              } | undefined;

              return [
                ft(
                  folio?.folio_code ?? "Sin folio",
                  <div key={`f-${reservation.id}`}>
                    <span>{folio?.folio_code ?? "Sin folio"}</span>
                    <ReservationGuestsAccordion guests={allGuests} reservationId={reservation.id} />
                  </div>,
                ),
                guest?.full_name ?? "Sin huésped",
                guest?.phone ?? "-",
                bed?.bed_number ? `Cama ${bed.bed_number}` : "Pendiente",
                `${reservation.check_in_date} → ${reservation.check_out_date}`,
                `${reservation.nights} noche(s)`,
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
            })}
          />
        </div>
      </Card>
    </>
  );
}
