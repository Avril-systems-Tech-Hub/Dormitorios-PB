type ReservationGuestLocker = {
  locker_number?: number | null;
  locker_days?: number | null;
};

export function formatLockerLabel(
  lockerNumber: number | null | undefined,
  lockerDays: number | null | undefined,
) {
  const days = Number(lockerDays ?? 0);
  const locker = lockerNumber != null && lockerNumber > 0 ? Number(lockerNumber) : null;

  if (locker != null) return `Locker ${locker}`;
  if (days > 0) return "Locker pendiente";
  return null;
}

export function formatBedLockerLabel(
  bedNumber: number | undefined | null,
  lockerNumber: number | null | undefined,
  lockerDays: number | null | undefined,
) {
  const bedPart = bedNumber ? `Cama ${bedNumber}` : "Pendiente";
  const lockerPart = formatLockerLabel(lockerNumber, lockerDays);
  if (lockerPart) return `${bedPart} · ${lockerPart}`;
  return bedPart;
}

export function sumLockerDays(guests: ReservationGuestLocker[]) {
  return guests.reduce((sum, guest) => sum + Number(guest.locker_days ?? 0), 0);
}

export function ReservationNightsCell({
  nights,
  lockerDays,
}: {
  nights: number;
  lockerDays: number;
}) {
  return (
    <div className="leading-snug">
      <span>{nights} noche{nights === 1 ? "" : "s"}</span>
      {lockerDays > 0 ? (
        <span className="mt-0.5 block text-xs text-text-muted">
          Locker: {lockerDays} día{lockerDays === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}
