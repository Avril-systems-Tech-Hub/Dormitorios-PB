import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getFinanceDayOptions,
  getMexicoCityMonthBounds,
  getMexicoCityWeekBounds,
} from "@/lib/dates";
import { getVisitorSalesTotalsForDates } from "@/lib/visitor-sales";

export type DayFinanceSummary = {
  totalGuestIncome: number;
  totalExpenses: number;
  netResult: number;
};

export type DailyFinanceEntry = DayFinanceSummary & {
  date: string;
};

export type DayFinanceGuestLine = {
  folioCode: string;
  guestNames: string[];
  nights: number;
  checkIn: string;
  checkOut: string;
  paidAmount: number;
};

export type DailyFinanceGuestDetailsByDate = Record<string, DayFinanceGuestLine[]>;

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function sumFinance(
  payments: { amount: number | string }[] | null,
  expenses: { amount: number | string }[] | null,
  visitorIncome = 0,
): DayFinanceSummary {
  const totalGuestIncome =
    (payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0) + visitorIncome;
  const totalExpenses = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const netResult = Number((totalGuestIncome - totalExpenses).toFixed(2));

  return { totalGuestIncome, totalExpenses, netResult };
}

export async function getDayFinanceSummary(
  supabase: SupabaseClient,
  dateString: string,
): Promise<DayFinanceSummary> {
  const [{ data: payments }, { data: expenses }, visitorIncome] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("effective_date", dateString),
    supabase
      .from("cash_movements")
      .select("amount")
      .eq("direction", "expense")
      .eq("movement_date", dateString),
    getVisitorSalesTotalsForDates(supabase, dateString, dateString),
  ]);

  return sumFinance(payments, expenses, visitorIncome);
}

export async function getWeekFinanceSummary(
  supabase: SupabaseClient,
  dateString: string,
): Promise<DayFinanceSummary> {
  const { start, end } = getMexicoCityWeekBounds(dateString);

  const [{ data: payments }, { data: expenses }, visitorIncome] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .gte("effective_date", start)
      .lte("effective_date", end),
    supabase
      .from("cash_movements")
      .select("amount")
      .eq("direction", "expense")
      .gte("movement_date", start)
      .lte("movement_date", end),
    getVisitorSalesTotalsForDates(supabase, start, end),
  ]);

  return sumFinance(payments, expenses, visitorIncome);
}

export async function getMonthFinanceSummary(
  supabase: SupabaseClient,
  dateString: string,
): Promise<DayFinanceSummary> {
  const { start, end } = getMexicoCityMonthBounds(dateString);

  const [{ data: payments }, { data: expenses }, visitorIncome] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .gte("effective_date", start)
      .lte("effective_date", end),
    supabase
      .from("cash_movements")
      .select("amount")
      .eq("direction", "expense")
      .gte("movement_date", start)
      .lte("movement_date", end),
    getVisitorSalesTotalsForDates(supabase, start, end),
  ]);

  return sumFinance(payments, expenses, visitorIncome);
}

function datesInRange(startDate: string, endDate: string) {
  const monthKey = startDate.slice(0, 7);
  return getFinanceDayOptions(monthKey)
    .map((option) => option.value)
    .filter((date) => date >= startDate && date <= endDate)
    .reverse();
}

export async function getDailyFinanceSummariesInRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<DailyFinanceEntry[]> {
  const [{ data: payments }, { data: expenses }, { data: showers }, { data: lockers }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("amount, effective_date")
        .gte("effective_date", startDate)
        .lte("effective_date", endDate),
      supabase
        .from("cash_movements")
        .select("amount, movement_date")
        .eq("direction", "expense")
        .gte("movement_date", startDate)
        .lte("movement_date", endDate),
      supabase
        .from("visitor_shower_sales")
        .select("amount, sold_date")
        .gte("sold_date", startDate)
        .lte("sold_date", endDate),
      supabase
        .from("visitor_locker_sales")
        .select("amount, sold_date")
        .gte("sold_date", startDate)
        .lte("sold_date", endDate),
    ]);

  const totals = new Map<string, { income: number; expenses: number }>();

  for (const payment of payments ?? []) {
    const date = String(payment.effective_date);
    if (date < startDate || date > endDate) continue;
    const row = totals.get(date) ?? { income: 0, expenses: 0 };
    row.income += Number(payment.amount);
    totals.set(date, row);
  }

  for (const sale of [...(showers ?? []), ...(lockers ?? [])]) {
    const date = String((sale as { sold_date?: string }).sold_date);
    if (date < startDate || date > endDate) continue;
    const row = totals.get(date) ?? { income: 0, expenses: 0 };
    row.income += Number((sale as { amount?: number | string }).amount ?? 0);
    totals.set(date, row);
  }

  for (const expense of expenses ?? []) {
    const date = String(expense.movement_date);
    if (date < startDate || date > endDate) continue;
    const row = totals.get(date) ?? { income: 0, expenses: 0 };
    row.expenses += Number(expense.amount);
    totals.set(date, row);
  }

  return datesInRange(startDate, endDate).map((date) => {
    const row = totals.get(date) ?? { income: 0, expenses: 0 };
    const totalGuestIncome = row.income;
    const totalExpenses = row.expenses;
    const netResult = Number((totalGuestIncome - totalExpenses).toFixed(2));
    return { date, totalGuestIncome, totalExpenses, netResult };
  });
}

type ReservationGuestPaymentRow = {
  nights?: number;
  check_in_date?: string;
  check_out_date?: string;
  reservation_guests?:
    | { guests?: { full_name?: string } | { full_name?: string }[] | null }[]
    | null;
};

type PaymentGuestRow = {
  amount: number | string;
  effective_date: string;
  folios?: {
    folio_code?: string;
    reservations?: ReservationGuestPaymentRow | ReservationGuestPaymentRow[] | null;
  } | {
    folio_code?: string;
    reservations?: ReservationGuestPaymentRow | ReservationGuestPaymentRow[] | null;
  }[];
};

function guestNamesFromReservation(reservation: ReservationGuestPaymentRow | undefined) {
  if (!reservation) return [];
  const rows = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests : [];
  return rows
    .map((row) => unwrap(row.guests)?.full_name?.trim())
    .filter((name): name is string => Boolean(name));
}

export async function getDailyFinanceGuestDetailsInRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<DailyFinanceGuestDetailsByDate> {
  const { data: payments } = await supabase
    .from("payments")
    .select(
      `amount, effective_date,
      folios!inner(
        folio_code,
        reservations(
          nights, check_in_date, check_out_date,
          reservation_guests(guests(full_name))
        )
      )`,
    )
    .gte("effective_date", startDate)
    .lte("effective_date", endDate);

  const byDate = new Map<string, Map<string, DayFinanceGuestLine>>();

  for (const payment of (payments ?? []) as PaymentGuestRow[]) {
    const date = payment.effective_date;
    if (date < startDate || date > endDate) continue;

    const folio = unwrap(payment.folios);
    const folioCode = folio?.folio_code ?? "Sin folio";
    const reservation = folio ? unwrap(folio.reservations) : undefined;
    const guestNames = guestNamesFromReservation(reservation);
    const nights = reservation?.nights ?? 0;
    const checkIn = reservation?.check_in_date ?? "";
    const checkOut = reservation?.check_out_date ?? "";
    const amount = Number(payment.amount);

    const dayMap = byDate.get(date) ?? new Map<string, DayFinanceGuestLine>();
    const existing = dayMap.get(folioCode);

    if (existing) {
      existing.paidAmount = Number((existing.paidAmount + amount).toFixed(2));
      const merged = new Set([...existing.guestNames, ...guestNames]);
      existing.guestNames = [...merged];
    } else {
      dayMap.set(folioCode, {
        folioCode,
        guestNames,
        nights,
        checkIn,
        checkOut,
        paidAmount: amount,
      });
    }

    byDate.set(date, dayMap);
  }

  const [{ data: showers }, { data: lockers }] = await Promise.all([
    supabase
      .from("visitor_shower_sales")
      .select("id, visitor_name, resource_number, amount, sold_date")
      .gte("sold_date", startDate)
      .lte("sold_date", endDate),
    supabase
      .from("visitor_locker_sales")
      .select("id, visitor_name, resource_number, amount, sold_date")
      .gte("sold_date", startDate)
      .lte("sold_date", endDate),
  ]);

  type VisitorDetailRow = {
    id: string;
    visitor_name?: string | null;
    resource_number?: string | null;
    amount: number | string;
    sold_date: string;
  };

  function addVisitorDetails(rows: VisitorDetailRow[] | null, concept: "Regadera" | "Locker") {
    for (const sale of rows ?? []) {
      const date = sale.sold_date;
      if (date < startDate || date > endDate) continue;
      const folioCode = `Invitado · ${concept}${sale.resource_number ? ` ${sale.resource_number}` : ""}`;
      const dayMap = byDate.get(date) ?? new Map<string, DayFinanceGuestLine>();
      dayMap.set(folioCode + sale.id, {
        folioCode,
        guestNames: [sale.visitor_name?.trim() || "Invitado"],
        nights: 0,
        checkIn: date,
        checkOut: date,
        paidAmount: Number(sale.amount),
      });
      byDate.set(date, dayMap);
    }
  }

  addVisitorDetails((showers ?? []) as VisitorDetailRow[], "Regadera");
  addVisitorDetails((lockers ?? []) as VisitorDetailRow[], "Locker");

  const result: DailyFinanceGuestDetailsByDate = {};
  for (const [date, folioMap] of byDate) {
    result[date] = [...folioMap.values()].sort((a, b) => b.paidAmount - a.paidAmount);
  }
  return result;
}
