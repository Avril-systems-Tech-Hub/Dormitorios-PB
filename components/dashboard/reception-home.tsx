import { ReceptionCheckInWizard } from "@/components/dashboard/reception-check-in-wizard";
import { ReceptionReservationPanel } from "@/components/dashboard/reception-reservation-panel";
import {
  ReceptionGuestRosterContent,
  rosterParamsActive,
} from "@/components/dashboard/reception-guest-roster-content";
import { ReceptionGuestRosterPanel } from "@/components/dashboard/reception-guest-roster-panel";
import { ReceptionShiftHeader } from "@/components/dashboard/reception-shift-header";
import { getRecentReceptionReservations } from "@/actions/operations";
import { DEFAULT_RECENT_RESERVATION_LIMIT } from "@/lib/reception-check-in";
import { formatOpenShiftLabel, type OpenShiftInfo } from "@/lib/open-shift";

type ReceptionHomeProps = {
  openShift: OpenShiftInfo;
  shiftExpenseTotal: number;
  searchParams: Record<string, string | string[] | undefined>;
};

export async function ReceptionHome({
  openShift,
  shiftExpenseTotal,
  searchParams,
}: ReceptionHomeProps) {
  const shiftLabel = formatOpenShiftLabel(openShift);
  const recentReservations = await getRecentReceptionReservations(DEFAULT_RECENT_RESERVATION_LIMIT);
  const rosterExpanded = rosterParamsActive(searchParams);

  return (
    <div className="space-y-4 sm:space-y-5">
      <ReceptionShiftHeader shiftLabel={shiftLabel} shiftExpenseTotal={shiftExpenseTotal} />
      <ReceptionCheckInWizard initialRecentReservations={recentReservations} />
      <ReceptionReservationPanel />
      <ReceptionGuestRosterPanel defaultExpanded={rosterExpanded}>
        <ReceptionGuestRosterContent
          searchParams={searchParams}
          basePath="/dashboard"
          paramPrefix="roster"
          embedded
        />
      </ReceptionGuestRosterPanel>
    </div>
  );
}
