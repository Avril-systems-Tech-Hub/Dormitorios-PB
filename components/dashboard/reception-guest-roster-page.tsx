import { Card } from "@/components/ui/card";
import { ReceptionGuestRosterContent } from "@/components/dashboard/reception-guest-roster-content";

export async function ReceptionGuestRosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <ReceptionGuestRosterContent searchParams={params} basePath="/dashboard/guests" />
      </Card>
    </div>
  );
}
