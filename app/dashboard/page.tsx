import Link from "next/link";
import { ActiveReservationsPanel } from "@/components/dashboard/active-reservations-panel";
import { ExpenseRegisterPanel } from "@/components/dashboard/expense-register-panel";
import { FinanceResultCard } from "@/components/dashboard/finance-result-card";
import { ReservationsFinanceChart } from "@/components/dashboard/reservations-finance-chart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { getDayFinanceSummary, getMonthFinanceSummary } from "@/lib/day-finance";
import { formatMexicoCityMonthLabel, getMexicoCityDateString } from "@/lib/dates";

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = getMexicoCityDateString();

  if (profile.role !== "admin") {
    return (
      <div className="min-w-0 space-y-4">
        <ActiveReservationsPanel />
        <ExpenseRegisterPanel returnTo="/dashboard" />
      </div>
    );
  }

  const finance = await getDayFinanceSummary(supabase, today);
  const monthFinance = await getMonthFinanceSummary(supabase, today);
  const monthLabel = formatMexicoCityMonthLabel(today);

  const { count: availableBeds } = await supabase
    .from("beds")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");
  const { count: activeFolios } = await supabase
    .from("folios")
    .select("id", { count: "exact", head: true })
    .neq("payment_status", "liquidated");
  const { data: openShift } = await supabase
    .from("shifts")
    .select("id,status")
    .eq("status", "open")
    .maybeSingle();

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/beds"
          className="block rounded-xl transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        >
          <Card className="h-full transition hover:border-brand-primary/40 hover:bg-surface-soft/40">
            <p className="text-sm text-text-muted">Camas disponibles</p>
            <p className="mt-1 text-2xl font-semibold">{availableBeds ?? 0}</p>
            <Badge className="mt-2">Inventario vivo</Badge>
          </Card>
        </Link>
        <Link
          href="/dashboard/guests"
          className="block rounded-xl transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        >
          <Card className="h-full transition hover:border-brand-primary/40 hover:bg-surface-soft/40">
            <p className="text-sm text-text-muted">Folios activos</p>
            <p className="mt-1 text-2xl font-semibold">{activeFolios ?? 0}</p>
            <Badge variant="warning" className="mt-2">
              En operación
            </Badge>
          </Card>
        </Link>
        <Link
          href="/dashboard/shifts"
          className="block rounded-xl transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        >
          <Card className="h-full transition hover:border-brand-primary/40 hover:bg-surface-soft/40">
            <p className="text-sm text-text-muted">Turno</p>
            <p className="mt-1 text-2xl font-semibold">{openShift ? "Abierto" : "Cerrado"}</p>
            <Badge className="mt-2">Recepción</Badge>
          </Card>
        </Link>
        <FinanceResultCard day={finance} month={monthFinance} monthLabel={monthLabel} />
      </div>

      <ReservationsFinanceChart day={finance} month={monthFinance} monthLabel={monthLabel} />
    </div>
  );
}
