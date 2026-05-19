import { createExpenseAction, receptionReservationPaymentAction } from "@/actions/operations";
import { ReceptionExpensePanel } from "@/components/dashboard/reception-expense-panel";
import { ExpenseCaptureForm } from "@/components/forms/expense-capture-form";
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
import { getDayFinanceSummary } from "@/lib/day-finance";
import { getMexicoCityDateString } from "@/lib/dates";
import { getExpenseConceptLabel } from "@/lib/expense-concepts";

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = getMexicoCityDateString();

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

        <ReceptionExpensePanel />

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

  const finance = await getDayFinanceSummary(supabase, today);

  const { data: recentExpenses } = await supabase
    .from("cash_movements")
    .select("movement_date,expense_concept,concept_detail,amount,recorded_at")
    .eq("direction", "expense")
    .order("recorded_at", { ascending: false })
    .limit(8);

  const { count: availableBeds } = await supabase
    .from("beds")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");
  const { count: activeFolios } = await supabase
    .from("folios")
    .select("id", { count: "exact", head: true })
    .neq("payment_status", "liquidated");
  const { data: openShift } = await supabase.from("shifts").select("id,status").eq("status", "open").maybeSingle();
  const { data: todayReservations } = await supabase
    .from("reservations")
    .select("id,reservation_source,created_at")
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);
  const totalReservationsToday = (todayReservations ?? []).length;
  const appCreatedCount = (todayReservations ?? []).filter((r) => r.reservation_source === "guest_app").length;
  const cashierCreatedCount = (todayReservations ?? []).filter((r) => r.reservation_source === "cashier_counter").length;
  const appCreatedPct = totalReservationsToday > 0 ? (appCreatedCount / totalReservationsToday) * 100 : 0;
  const cashierCreatedPct = totalReservationsToday > 0 ? (cashierCreatedCount / totalReservationsToday) * 100 : 0;

  const expenseRows =
    (recentExpenses ?? []).map((expense) => {
      const conceptLabel = getExpenseConceptLabel(expense.expense_concept);
      const detail =
        expense.expense_concept === "extras" && expense.concept_detail
          ? `${conceptLabel}: ${expense.concept_detail}`
          : conceptLabel;
      return [
        expense.movement_date,
        detail,
        `$${Number(expense.amount).toFixed(2)}`,
        new Date(expense.recorded_at).toLocaleTimeString("es-MX", {
          timeZone: "America/Mexico_City",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ];
    }) ?? [];

  return (
    <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
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
        <p className="mt-1 text-2xl font-semibold">${finance.totalGuestIncome.toFixed(2)}</p>
        <Badge variant="success" className="mt-2">
          Pagos huéspedes
        </Badge>
      </Card>
      <Card>
        <p className="text-sm text-text-muted">Gastos del día</p>
        <p className="mt-1 text-2xl font-semibold">${finance.totalExpenses.toFixed(2)}</p>
        <Badge variant="warning" className="mt-2">
          Operación
        </Badge>
      </Card>
      <Card>
        <p className="text-sm text-text-muted">Resultado neto</p>
        <p className="mt-1 text-2xl font-semibold">${finance.netResult.toFixed(2)}</p>
        <Badge variant={finance.netResult >= 0 ? "success" : "warning"} className="mt-2">
          {finance.netResult >= 0 ? "Positivo" : "Negativo"}
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

    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-base font-semibold text-text-main">Registrar gasto</h2>
        <p className="mt-1 text-sm text-text-muted">Un concepto por registro. Foto opcional.</p>
        <div className="mt-4">
          <ExpenseCaptureForm action={createExpenseAction} returnTo="/dashboard" />
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text-main">Últimos gastos</h2>
          <a href="/dashboard/expenses" className="text-sm text-brand-primary underline">
            Ver todos
          </a>
        </div>
        <div className="mt-3">
          <ResponsiveTable headers={["Fecha", "Concepto", "Monto", "Hora"]} rows={expenseRows} />
        </div>
      </Card>
    </div>
    </div>
  );
}
