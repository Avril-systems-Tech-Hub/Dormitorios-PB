import { ReceptionCheckInWizard } from "@/components/dashboard/reception-check-in-wizard";
import {
  ReceptionGuestRosterContent,
  rosterParamsActive,
} from "@/components/dashboard/reception-guest-roster-content";
import { ReceptionGuestRosterPanel } from "@/components/dashboard/reception-guest-roster-panel";
import { ReceptionShiftHeader } from "@/components/dashboard/reception-shift-header";
import {
  getRecentReceptionReservations,
  getReceptionReservationDetailAction,
} from "@/actions/operations";
import { DEFAULT_RECENT_RESERVATION_LIMIT } from "@/lib/reception-check-in";
import { formatOpenShiftLabel, type OpenShiftInfo } from "@/lib/open-shift";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReceptionHomeProps = {
  openShift: OpenShiftInfo;
  shiftExpenseTotal: number;
  shiftExpenseCount?: number;
  searchParams: Record<string, string | string[] | undefined>;
};

export async function ReceptionHome({
  openShift,
  shiftExpenseTotal,
  shiftExpenseCount = 0,
  searchParams,
}: ReceptionHomeProps) {
  const shiftLabel = formatOpenShiftLabel(openShift);
  const rawCheckInReservation = searchParams.checkin_reservation;
  const checkInReservationId =
    typeof rawCheckInReservation === "string" ? rawCheckInReservation.trim() : "";
  const shouldConsumeCheckInReservation = rawCheckInReservation !== undefined;
  const [recentReservations, initialReservationResponse] = await Promise.all([
    getRecentReceptionReservations(DEFAULT_RECENT_RESERVATION_LIMIT),
    checkInReservationId && UUID_PATTERN.test(checkInReservationId)
      ? getReceptionReservationDetailAction(checkInReservationId)
      : Promise.resolve(null),
  ]);
  const initialReservation = initialReservationResponse?.success
    ? initialReservationResponse.result
    : undefined;
  const initialReservationError = shouldConsumeCheckInReservation && !initialReservation
    ? initialReservationResponse?.message ??
      "No se pudo abrir la reservación recién creada. Puedes buscarla manualmente."
    : undefined;
  const rosterExpanded = rosterParamsActive(searchParams);

  return (
    <div className="space-y-4 sm:space-y-5">
      <ReceptionShiftHeader
        shiftLabel={shiftLabel}
        shiftExpenseTotal={shiftExpenseTotal}
        shiftExpenseCount={shiftExpenseCount}
      />
      <ReceptionCheckInWizard
        initialRecentReservations={recentReservations}
        initialReservation={initialReservation}
        initialReservationError={initialReservationError}
      />
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
