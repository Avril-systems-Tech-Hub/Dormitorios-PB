import { receptionReservationPaymentAction } from "@/actions/operations";
import { ReceptionPaymentToggleForm } from "@/components/forms/reception-payment-toggle-form";
import { ReservationGuestsAccordion } from "@/components/ui/reservation-guests-accordion";
import { ResendReceiptButton } from "@/components/ui/resend-receipt-button";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

  if (profile.role === "reception") {
    const adminSupabase = createAdminClient();

    const { data: reservations } = await adminSupabase
      .from("reservations")
      .select(
        "id,created_at,status,reservation_source,check_in_date,check_out_date,nights,notes,profiles(full_name),folios(id,folio_code,payment_status,balance_due,total_amount),reservation_guests(guest_id,guests(full_name,phone,email),beds(bed_number))",
      )
      .order("created_at", { ascending: false })
      .limit(40);

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-text-muted">Nuevas reservaciones</p>
            <p className="mt-1 text-2xl font-semibold">{(reservations ?? []).length}</p>
          </Card>
          <Card>
            <p className="text-sm text-text-muted">Pagadas</p>
            <p className="mt-1 text-2xl font-semibold">
              {(reservations ?? []).filter((r) => {
                const folio = r.folios as { payment_status?: string } | undefined;
                return folio?.payment_status === "liquidated";
              }).length}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-text-muted">No pagadas</p>
            <p className="mt-1 text-2xl font-semibold">
              {(reservations ?? []).filter((r) => {
                const folio = r.folios as { payment_status?: string } | undefined;
                return folio?.payment_status !== "liquidated";
              }).length}
            </p>
          </Card>
        </div>

        <Card>
          <h2 className="text-base font-semibold text-text-main">Reservaciones activas</h2>
          <p className="mt-1 text-sm text-text-muted">Control de check-in, cama asignada y estado de pago por folio.</p>
          <div className="mt-3">
            <ResponsiveTable
              headers={["Folio", "Huésped", "Teléfono", "Cama", "Fechas", "Noches", "Creada", "Origen", "Pago", "Total", "Saldo", "Actualizar pago"]}
              rows={(reservations ?? []).map((reservation) => {
                const allGuests = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests : [];
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
                  `${reservation.check_in_date} -> ${reservation.check_out_date}`,
                  `${reservation.nights} noche(s)`,
                  reservation.created_at
                    ? new Date(reservation.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—",
                  ft(
                    reservation.reservation_source === "cashier_counter" ? "Caja" : "App cliente",
                    reservation.reservation_source === "cashier_counter" ? (
                      <Badge key={`s-${reservation.id}`} variant="warning">Caja</Badge>
                    ) : (
                      <Badge key={`s-${reservation.id}`} variant="success">App cliente</Badge>
                    ),
                  ),
                  ft(
                    folio?.payment_status ?? "pending",
                    <Badge key={`p-${reservation.id}`} variant={folio?.payment_status === "liquidated" ? "success" : "warning"}>
                      {folio?.payment_status ?? "pending"}
                    </Badge>,
                  ),
                  `$${Number(folio?.total_amount ?? 0).toFixed(2)}`,
                  `$${Number(folio?.balance_due ?? 0).toFixed(2)}`,
                  folio?.payment_status === "liquidated" && folio?.id ? (
                    <ResendReceiptButton key={`rr-${reservation.id}`} folioId={folio.id} />
                  ) : folio?.id ? (
                    <ReceptionPaymentToggleForm
                      key={`pay-${reservation.id}`}
                      action={receptionReservationPaymentAction}
                      folioId={folio.id}
                    />
                  ) : (
                    <span key={`np-${reservation.id}`} className="text-xs text-red-600">Sin folio</span>
                  ),
                ];
              })}
            />
          </div>
        </Card>

      </div>
    );
  }

  const { count: availableBeds } = await supabase
    .from("beds")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");
  const { count: activeFolios } = await supabase
    .from("folios")
    .select("id", { count: "exact", head: true })
    .neq("payment_status", "liquidated");
  const { data: todayPayments } = await supabase
    .from("payments")
    .select("amount")
    .gte("received_at", `${today}T00:00:00`)
    .lte("received_at", `${today}T23:59:59`);
  const { data: openShift } = await supabase.from("shifts").select("id,status").eq("status", "open").maybeSingle();
  const { data: todayReservations } = await supabase
    .from("reservations")
    .select("id,reservation_source,created_at")
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);
  const totalDayIncome = (todayPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalReservationsToday = (todayReservations ?? []).length;
  const appCreatedCount = (todayReservations ?? []).filter((r) => r.reservation_source === "guest_app").length;
  const cashierCreatedCount = (todayReservations ?? []).filter((r) => r.reservation_source === "cashier_counter").length;
  const appCreatedPct = totalReservationsToday > 0 ? (appCreatedCount / totalReservationsToday) * 100 : 0;
  const cashierCreatedPct = totalReservationsToday > 0 ? (cashierCreatedCount / totalReservationsToday) * 100 : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card>
        <p className="text-sm text-text-muted">Camas disponibles</p>
        <p className="mt-1 text-2xl font-semibold">{availableBeds ?? 0}</p>
        <Badge className="mt-2">Inventario vivo</Badge>
      </Card>
      <Card>
        <p className="text-sm text-text-muted">Folios activos</p>
        <p className="mt-1 text-2xl font-semibold">{activeFolios ?? 0}</p>
        <Badge variant="warning" className="mt-2">
          En operación
        </Badge>
      </Card>
      <Card>
        <p className="text-sm text-text-muted">Ingresos del día</p>
        <p className="mt-1 text-2xl font-semibold">${totalDayIncome.toFixed(2)}</p>
        <Badge variant="success" className="mt-2">
          Actualizado
        </Badge>
      </Card>
      <Card>
        <p className="text-sm text-text-muted">Turno</p>
        <p className="mt-1 text-2xl font-semibold">{openShift ? "Abierto" : "Cerrado"}</p>
        <Badge className="mt-2">Recepción</Badge>
      </Card>
      <Card>
        <p className="text-sm text-text-muted">Reservas app (hoy)</p>
        <p className="mt-1 text-2xl font-semibold">{appCreatedCount}</p>
        <Badge variant="success" className="mt-2">
          {appCreatedPct.toFixed(1)}%
        </Badge>
      </Card>
      <Card>
        <p className="text-sm text-text-muted">Reservas caja (hoy)</p>
        <p className="mt-1 text-2xl font-semibold">{cashierCreatedCount}</p>
        <Badge variant={cashierCreatedCount > 0 ? "warning" : "default"} className="mt-2">
          {cashierCreatedPct.toFixed(1)}%
        </Badge>
      </Card>
    </div>
  );
}
