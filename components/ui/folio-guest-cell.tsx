"use client";

import { ReservationGuestsAccordion } from "@/components/ui/reservation-guests-accordion";
import type { GuestAssignmentGuestRow } from "@/components/ui/guest-assignment-actions";

export function FolioGuestCell({
  primaryName,
  folioCode,
  guests,
  reservationId,
  nights = 1,
  returnTo = "/dashboard/payments",
}: {
  primaryName: string;
  folioCode: string;
  guests: GuestAssignmentGuestRow[];
  reservationId: string;
  nights?: number;
  returnTo?: string;
}) {
  const extraCount = Math.max(0, guests.length - 1);

  return (
    <div className="min-w-[10rem]">
      <p className="font-medium text-text-main">
        {primaryName}
        {extraCount > 0 ? (
          <span className="font-normal text-text-muted"> +{extraCount}</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs text-text-muted">{folioCode}</p>
      {reservationId && guests.length > 0 ? (
        <ReservationGuestsAccordion
          guests={guests}
          reservationId={reservationId}
          nights={nights}
          returnTo={returnTo}
          readOnly
        />
      ) : null}
    </div>
  );
}
