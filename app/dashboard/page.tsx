import { receptionReservationPaymentAction } from "@/actions/operations";
import { ReceptionPaymentToggleForm } from "@/components/forms/reception-payment-toggle-form";
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
        "id,status,reservation_source,check_in_date,check_out_date,nights,notes,profiles(full_name),folios(id,folio_code,payment_status,balance_due),reservation_guests(guests(full_name,phone),beds(bed_number))",
      )
      .order("created_at", { ascending: false })
      .limit(40);

    const { data: beds } = await adminSupabase
      .from("beds")
      .select("id,bed_number,status")
      .order("bed_number", { ascending: true })
      .limit(60);

    const { data: occupiedRows } = await adminSupabase
      .from("reservation_guests")
      .select("bed_id,reservations!inner(status)")
      .in(
        "reservation_id",
        (
          await adminSupabase
            .from("reservations")
            .select("id")
            .in("status", ["active", "confirmed"])
        ).data?.map((r) => r.id) ?? [],
      );
    const occupiedSet = new Set((occupiedRows ?? []).map((row) => row.bed_id));

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
          <div className="mt-3 overflow-hidden rounded-xl border border-border-soft bg-white shadow-sm">
            {(reservations ?? []).length === 0 ? (
              <p className="p-4 text-sm text-text-muted">No hay reservaciones activas para mostrar.</p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full text-sm">
                <thead className="bg-surface-soft text-left text-text-muted">
                  <tr>
                    <th className="px-3 py-3 font-medium">Folio</th>
                    <th className="px-3 py-3 font-medium">Huésped</th>
                    <th className="px-3 py-3 font-medium">Teléfono</th>
                    <th className="px-3 py-3 font-medium">Cama</th>
                    <th className="px-3 py-3 font-medium">Fechas</th>
                    <th className="px-3 py-3 font-medium">Noches</th>
                    <th className="px-3 py-3 font-medium">Origen</th>
                    <th className="px-3 py-3 font-medium">Pago</th>
                    <th className="px-3 py-3 font-medium">Saldo</th>
                    <th className="px-3 py-3 font-medium">Actualizar pago</th>
                  </tr>
                </thead>
                <tbody>
                  {(reservations ?? []).map((reservation) => {
                      const assignment = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests[0] : null;
                      const guest = assignment?.guests as { full_name?: string; phone?: string } | undefined;
                      const bed = assignment?.beds as { bed_number?: number } | undefined;
                      const folio = reservation.folios as {
                        id?: string;
                        folio_code?: string;
                        balance_due?: number;
                        payment_status?: string;
                      } | undefined;

                      return (
                        <tr key={reservation.id} className="border-t border-border-soft align-top">
                          <td className="px-3 py-3 text-text-main">{folio?.folio_code ?? "Sin folio"}</td>
                          <td className="px-3 py-3 text-text-main">{guest?.full_name ?? "Sin huésped"}</td>
                          <td className="px-3 py-3 text-text-main">{guest?.phone ?? "-"}</td>
                          <td className="px-3 py-3 text-text-main">{bed?.bed_number ? `Cama ${bed.bed_number}` : "Pendiente"}</td>
                          <td className="px-3 py-3 text-text-main">
                            {reservation.check_in_date} {"->"} {reservation.check_out_date}
                          </td>
                          <td className="px-3 py-3 text-text-main">{reservation.nights} noche(s)</td>
                          <td className="px-3 py-3">
                            {reservation.reservation_source === "cashier_counter" ? (
                              <Badge variant="warning">Caja</Badge>
                            ) : (
                              <Badge variant="success">App cliente</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={folio?.payment_status === "liquidated" ? "success" : "warning"}>
                              {folio?.payment_status ?? "pending"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-text-main">${Number(folio?.balance_due ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-3">
                            {folio?.id ? (
                              <ReceptionPaymentToggleForm
                                action={receptionReservationPaymentAction}
                                folioId={folio.id}
                              />
                            ) : (
                              <span className="text-xs text-red-600">Sin folio</span>
                            )}
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card>
          <details>
            <summary className="cursor-pointer list-none text-base font-semibold text-text-main">
              Mapa de camas (mostrar/ocultar)
            </summary>
            <p className="mt-2 text-sm text-text-muted">Se muestra colapsado para reducir ruido visual en operación.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {(beds ?? []).map((bed) => {
                const isBlocked = bed.status === "blocked";
                const isOccupied = occupiedSet.has(bed.id);
                return (
                  <div key={bed.id} className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-text-main">Cama {bed.bed_number}</p>
                    {isBlocked ? (
                      <Badge variant="danger" className="mt-2">
                        Bloqueada
                      </Badge>
                    ) : isOccupied ? (
                      <Badge variant="warning" className="mt-2">
                        Ocupada
                      </Badge>
                    ) : (
                      <Badge variant="success" className="mt-2">
                        Libre
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
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
