import { MonthlyReportView } from "@/components/dashboard/monthly-report-view";
import { requireModulePermission } from "@/lib/auth/guards";
import {
  getFinanceMonthOptions,
  getMexicoCityDateString,
  getMexicoCityMonthKey,
} from "@/lib/dates";
import { getMonthlyReport } from "@/lib/monthly-report";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("reports");

  const params = await searchParams;
  const today = getMexicoCityDateString();
  const currentMonth = getMexicoCityMonthKey(today);
  const monthOptions = getFinanceMonthOptions(36, today).filter(
    (option) => option.value < currentMonth,
  );
  const requestedMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const selectedMonth = monthOptions.some((option) => option.value === requestedMonth)
    ? requestedMonth!
    : monthOptions[0]?.value;

  if (!selectedMonth) {
    return (
      <p className="text-sm text-text-muted">
        Aún no hay meses concluidos disponibles para reportar.
      </p>
    );
  }

  const report = await getMonthlyReport(createAdminClient(), selectedMonth);

  return <MonthlyReportView report={report} monthOptions={monthOptions} />;
}
