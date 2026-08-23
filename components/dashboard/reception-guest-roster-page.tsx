import { Card } from "@/components/ui/card";
import {
  getRosterPeriodBounds,
  ReceptionGuestRosterContent,
} from "@/components/dashboard/reception-guest-roster-content";
import { VisitorSalesSection } from "@/components/dashboard/visitor-sales-section";

export async function ReceptionGuestRosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodBounds = getRosterPeriodBounds(params);

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <ReceptionGuestRosterContent searchParams={params} basePath="/dashboard/guests" />
      </Card>
      <VisitorSalesSection
        startDate={periodBounds.start}
        endDate={periodBounds.end}
        periodLabel={periodBounds.label}
        searchParams={params}
      />
    </div>
  );
}
