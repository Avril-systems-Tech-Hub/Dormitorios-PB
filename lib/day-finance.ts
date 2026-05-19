import type { SupabaseClient } from "@supabase/supabase-js";
import { getMexicoCityDayBounds } from "@/lib/dates";

export type DayFinanceSummary = {
  totalGuestIncome: number;
  totalExpenses: number;
  netResult: number;
};

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

  const totalGuestIncome = (payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const netResult = Number((totalGuestIncome - totalExpenses).toFixed(2));

  return { totalGuestIncome, totalExpenses, netResult };
}
