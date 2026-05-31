import type { SupabaseClient } from "@supabase/supabase-js";
import { getMexicoCityDayBounds, getMexicoCityMonthBounds } from "@/lib/dates";

export type DayFinanceSummary = {
  totalGuestIncome: number;
  totalExpenses: number;
  netResult: number;
};

function sumFinance(
  payments: { amount: number | string }[] | null,
  expenses: { amount: number | string }[] | null,
): DayFinanceSummary {
  const totalGuestIncome = (payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const netResult = Number((totalGuestIncome - totalExpenses).toFixed(2));

  return { totalGuestIncome, totalExpenses, netResult };
}

export async function getDayFinanceSummary(
  supabase: SupabaseClient,
  dateString: string,
): Promise<DayFinanceSummary> {
  const { start, end } = getMexicoCityDayBounds(dateString);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .gte("received_at", start)
    .lte("received_at", end);

  const { data: expenses } = await supabase
    .from("cash_movements")
    .select("amount")
    .eq("direction", "expense")
    .eq("movement_date", dateString);

  return sumFinance(payments, expenses);
}

export async function getMonthFinanceSummary(
  supabase: SupabaseClient,
  dateString: string,
): Promise<DayFinanceSummary> {
  const { start, end, startAt, endAt } = getMexicoCityMonthBounds(dateString);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .gte("received_at", startAt)
    .lte("received_at", endAt);

  const { data: expenses } = await supabase
    .from("cash_movements")
    .select("amount")
    .eq("direction", "expense")
    .gte("movement_date", start)
    .lte("movement_date", end);

  return sumFinance(payments, expenses);
}
