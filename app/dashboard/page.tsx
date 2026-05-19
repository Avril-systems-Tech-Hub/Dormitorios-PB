import { ActiveReservationsPanel } from "@/components/dashboard/active-reservations-panel";
import { ExpenseRegisterPanel } from "@/components/dashboard/expense-register-panel";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { getDayFinanceSummary } from "@/lib/day-finance";
import { getMexicoCityDateString } from "@/lib/dates";
import { getExpenseConceptLabel } from "@/lib/expense-concepts";

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = getMexicoCityDateString();

  if (profile.role === "reception") {
    return (
      <div className="space-y-4">
        <ActiveReservationsPanel />
        <ExpenseRegisterPanel returnTo="/dashboard" />
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

      <ActiveReservationsPanel />

      <ExpenseRegisterPanel returnTo="/dashboard" />

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
  );
}
