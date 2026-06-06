import { Suspense } from "react";
import Link from "next/link";
import { ReceptionOperationsSummary } from "@/components/dashboard/reception-operations-summary";
import { BedSummaryCard } from "@/components/dashboard/bed-summary-card";
import { FolioSummaryCard } from "@/components/dashboard/folio-summary-card";
import { buildBedOccupancyMap } from "@/lib/bed-occupancy";
import { computeBedSummaryCounts, parseBedSummaryFilter } from "@/lib/bed-summary";
import { ReceptionReservationPanel } from "@/components/dashboard/reception-reservation-panel";
import { FinanceResultCard } from "@/components/dashboard/finance-result-card";
import { ReservationsFinanceChart } from "@/components/dashboard/reservations-finance-chart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/guards";
import {
  getDailyFinanceGuestDetailsInRange,
  getDailyFinanceSummariesInRange,
  getDayFinanceSummary,
  getMonthFinanceSummary,
  getWeekFinanceSummary,
} from "@/lib/day-finance";
import {
  financeMonthKeyToAnchorDate,
  formatMexicoCityDayLabel,
  formatMexicoCityMonthLabel,
  getFinanceDayOptions,
  getFinanceMonthOptions,
  getFinanceWeekOptions,
  getMexicoCityDateString,
  getMexicoCityMonthBoundsFromKey,
  getReservationPeriodBounds,
  parseFinanceDayKey,
  parseFinanceMonthKey,
  parseFinanceWeekAnchor,
} from "@/lib/dates";
import { parseFolioSummaryFilter } from "@/lib/folio-summary";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const params = await searchParams;
  const today = getMexicoCityDateString();
  const selectedMonth = parseFinanceMonthKey(params.financeMonth, today);
  const monthAnchor = financeMonthKeyToAnchorDate(selectedMonth);
  const monthOptions = getFinanceMonthOptions(24, today);

  if (profile.role !== "admin") {
    return (
      <div className="min-w-0 space-y-4">
        <ReceptionReservationPanel />
        <ReceptionOperationsSummary />
      </div>
    );
  }

  const selectedDay = parseFinanceDayKey(params.financeDay, selectedMonth, today);
  const selectedWeek = parseFinanceWeekAnchor(params.financeWeek, selectedMonth, today);
  const dayOptions = getFinanceDayOptions(selectedMonth);
  const weekOptions = getFinanceWeekOptions(selectedMonth);

  const finance = await getDayFinanceSummary(supabase, today);
  const weekFinance = await getWeekFinanceSummary(supabase, today);
  const monthFinance = await getMonthFinanceSummary(supabase, monthAnchor);
  const chartDayFinance = await getDayFinanceSummary(supabase, selectedDay);
  const chartWeekFinance = await getWeekFinanceSummary(supabase, selectedWeek);
  const { start: monthStart, end: monthEnd } = getMexicoCityMonthBoundsFromKey(selectedMonth);
  const [dailyFinance, guestDetailsByDate] = await Promise.all([
    getDailyFinanceSummariesInRange(supabase, monthStart, monthEnd),
    getDailyFinanceGuestDetailsInRange(supabase, monthStart, monthEnd),
  ]);

  const weekLabel = getReservationPeriodBounds("week", today).label;
  const monthLabel = formatMexicoCityMonthLabel(monthAnchor);
  const chartDayLabel = formatMexicoCityDayLabel(selectedDay);
  const chartWeekLabel = getReservationPeriodBounds("week", selectedWeek).label;

  const bedFilter = parseBedSummaryFilter(params.bedFilter);
  const [{ data: beds }, { data: rgRows }] = await Promise.all([
    supabase.from("beds").select("id, status"),
    supabase
      .from("reservation_guests")
      .select(
        `bed_id, reservation_id, guest_id, locker_number, locker_days,
        guests(full_name, phone, email),
        reservations!inner(
          id, status, reservation_source, check_in_date, check_out_date, nights, notes, created_at,
          folios(folio_code, payment_status, total_amount, balance_due)
        )`,
      )
      .not("bed_id", "is", null),
  ]);
  const bedOccupancyMap = buildBedOccupancyMap(rgRows ?? [], today);
  const bedCounts = computeBedSummaryCounts(beds ?? [], bedOccupancyMap);
  const occupiedToday = bedCounts.inventario - bedCounts.libres;

  const folioFilter = parseFolioSummaryFilter(params.folioFilter);
  const [
    { count: foliosPorPagar },
    { count: foliosPagados },
    { count: foliosTodos },
  ] = await Promise.all([
    supabase
      .from("folios")
      .select("id", { count: "exact", head: true })
      .neq("payment_status", "liquidated"),
    supabase
      .from("folios")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "liquidated"),
    supabase.from("folios").select("id", { count: "exact", head: true }),
  ]);
  const folioCounts = {
    por_pagar: foliosPorPagar ?? 0,
    pagados: foliosPagados ?? 0,
    todos: foliosTodos ?? 0,
  };
  const { data: openShift } = await supabase
    .from("shifts")
    .select("id,status")
    .eq("status", "open")
    .maybeSingle();

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <Suspense fallback={
          <Card className="h-full animate-pulse">
            <div className="h-4 w-32 rounded bg-surface-soft" />
            <div className="mt-3 h-8 w-16 rounded bg-surface-soft" />
          </Card>
        }>
          <BedSummaryCard
            counts={bedCounts}
            initialFilter={bedFilter}
            occupiedToday={occupiedToday}
          />
        </Suspense>
        <Suspense fallback={
          <Card className="h-full animate-pulse">
            <div className="h-4 w-32 rounded bg-surface-soft" />
            <div className="mt-3 h-8 w-16 rounded bg-surface-soft" />
          </Card>
        }>
          <FolioSummaryCard counts={folioCounts} initialFilter={folioFilter} />
        </Suspense>
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
        <FinanceResultCard
          day={finance}
          week={weekFinance}
          month={monthFinance}
          weekLabel={weekLabel}
          monthLabel={monthLabel}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
        />
      </div>

      <ReservationsFinanceChart
        day={chartDayFinance}
        week={chartWeekFinance}
        month={monthFinance}
        monthLabel={monthLabel}
        dayLabel={chartDayLabel}
        weekLabel={chartWeekLabel}
        selectedMonth={selectedMonth}
        selectedDay={selectedDay}
        selectedWeek={selectedWeek}
        dayOptions={dayOptions}
        weekOptions={weekOptions}
        dailyEntries={dailyFinance}
        guestDetailsByDate={guestDetailsByDate}
      />
    </div>
  );
}
